var Jade = require('jade');
var Fs = require('fs');
var Path = require('path');
var localsRegex = /\(function \(([^)]*)\)/;
var falafel = require('falafel');
var HTMLtoJSX = require('htmltojsx');
var HtmlPrettifier = require('html').prettyPrint;
var pascalCase = require('change-case').pascalCase;
var snakeCase = require('change-case').snakeCase;

var converter = new HTMLtoJSX({
  createClass: true,
});

function insertNearLineMatching(str, regex, insert, offset) {
  var lines = str.split('\n');
  var idx = null;

  lines.forEach(function (line, i) {
    if (idx === null && line.match(regex)) {
      idx = i;
    }
  });

  if (idx === null) {
    throw new Error('Could not match ' + regex.toString() + ' in \n' + str);
  }
  idx += 1 + (offset || 0);
  lines.splice(idx, 0, insert);
  return lines.join('\n');
}

function stripEmptyLineAfterRenderReturn(str) {
  var lines = str.split('\n');
  var idx = null;

  lines.forEach(function (line, i) {
    if (idx === null && line.match(/return \(\s*$/)) {
      idx = i;
    }
  });

  if (lines[idx + 1].trim() === '') {
    lines.splice(idx + 1, 1);
  }

  return lines.join('\n');
}

function makePropTypes(props) {
  var str = ['  propTypes: {'];
  str = str.concat(props.map(function (p, i) {
    var str = '    ' + p + ': React.PropTypes.any';
    if (i < props.length - 1) {
      str += ',';
    }
    return str;
  }));

  str.push('  },');
  return str.join('\n');
}

function makeImports(replacements) {
  if (Object.keys(replacements).length === 0) { return '\n'; }

  return Object.keys(replacements).map(function (key) {
    return 'import ' + pascalCase(key) + ' from \'' + replacements[key] + '\';';
  }).join('\n') + '\n\n';
}

function fixJsxImports(jsx) {
  return jsx.replace(/jsx:(\w+)/g, function (_, match) {
    return pascalCase(match);
  });
}

function fixJsxCurlies(jsx) {
  return jsx.replace(/"\[\[{/g, '{').replace(/}\]\]"/g, '}');

}

function rewriteClass(jsx, props, replacements) {
  jsx = 'import React from \'react\';\n' + makeImports(replacements) + jsx;
  jsx = jsx.replace('React.createClass', 'export default React.createClass');
  jsx = jsx.replace(/: function\(/g, '(');
  if (props.length > 0) {
    jsx = insertNearLineMatching(
            jsx,
            /render\(/,
            '    let { ' + props.join(', ') + ' } = this.props;\n'
    );
    jsx = insertNearLineMatching(
            jsx,
            /React.createClass/,
            makePropTypes(props)
    );
  }
  jsx = fixJsxImports(jsx);
  jsx = fixJsxCurlies(jsx);
  jsx = stripEmptyLineAfterRenderReturn(jsx);
  return jsx;
}


function findProps(source) {
  var props = {};
  falafel(source, function (node) {
    if (node.type !== 'Identifier') return;

    if (node.parent.type === 'MemberExpression') {
      if (node.parent.object.type === 'Identifier') {
        props[node.parent.object.name] = true;
      }
    } else {
      props[node.name] = true;
    }
  });
  return Object.keys(props);
}

function buildReplacements(tmpl, filename, replacements) {
  var matchedReplacements = {};

  lines = tmpl.split('\n');
  lines = lines.map(function (line) {
    var match = line.match(/^(\s*)include\s+('|")?([^'"]*)('|")?$/);
    if (!match) return line;

    var f = match[3];
    if (!f.match(/\.jade$/)) f += '.jade';
    f = Path.join(Path.dirname(filename), f);

    if (replacements[f]) {
      var className = snakeCase(Path.basename(replacements[f], '.js'));
      matchedReplacements[className] = replacements[f];
      return (match[1] || '') + '<jsx:' + className + ' ></jsx:' + className + '>';
    } else {
      return line;
    }
  });

  return {
    replacements: matchedReplacements,
    template: lines.join('\n')
  };
}


module.exports = function (options) {
  options.inlineRuntimeFunctions = true;
  options.pretty = true;
  var template = Fs.readFileSync(options.filename).toString();
  var replacements = {};

  if (options.replacements || true) {
    var built = buildReplacements(template, options.filename, options.replacements);
    template = built.template;
    replacements = built.replacements;
  }

  var res = Jade.compileClient(template, options);
  var props = {};

  var output = falafel(res, function (node) {
    if (node.type === 'CallExpression') {
      if (node.callee.object.name === 'jade' && node.callee.property.name === 'escape') {
        var idNode = node.arguments[0].test.right.right;
        var id;

        if (idNode.type === 'Literal') {
          id = idNode.raw;
        } else {
          id = idNode.source();

          findProps(id).forEach(function (p) {
            props[p] = true;
          });
        }

        node.update('"{' + id.replace(/\"/g, '\\\"') + '}"');
      }

      if (node.callee.object.name === 'jade' && node.callee.property.name === 'attr') {
        var attrNode = node.arguments[0];
        var valNode = node.arguments[1];
        var val, attr;

        if (!attrNode.type === 'Literal') {
          console.dir(node);
          throw new Error('Cannot handle jade.attr');
        }

        attr = attrNode.value;

        if (valNode.type === 'Literal') {
          val = valNode.raw;
        } else {
          val = valNode.source();
          findProps(val).forEach(function (p) {
            props[p] = true;
          });
        }

        node.update('" ' + attr + '=\\"[[{' + val.replace(/\"/g, '\\\"').replace(/\'/g, "\\\'") + '}]]\\""');
      }
    }
  });
  var html = eval(output + '\n template({})');
  html = HtmlPrettifier(html);
  var jsx = converter.convert(html);
  jsx = rewriteClass(jsx, Object.keys(props).sort(), replacements);
  return jsx;
}

