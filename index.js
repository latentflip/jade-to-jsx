var Jade = require('jade');
var Fs = require('fs');
var localsRegex = /\(function \(([^)]*)\)/;
var falafel = require('falafel');
var HTMLtoJSX = require('htmltojsx');
var HtmlPrettifier = require('html').prettyPrint;

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

function rewriteClass(jsx, props) {
  jsx = 'import React from \'React\';\n\n' + jsx;
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

module.exports = function (options) {
  options.inlineRuntimeFunctions = true;
  var res = Jade.compileClient(Fs.readFileSync(options.filename), options);
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
    }
  });
  var html = eval(output + '\n template({})');
  html = HtmlPrettifier(html);
  var jsx = converter.convert(html);
  jsx = rewriteClass(jsx, Object.keys(props).sort());
  return jsx;
}
