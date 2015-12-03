function template(locals) {
  var buf = [];
  var jade_mixins = {};
  var jade_interp;
  ;
  var locals_for_with = (locals || {});
  
  (function (bar, foo) {
    buf.push(
      "<h1>Hello</h1><p>" + 
      (jade.escape(null == (jade_interp = foo) ? "" : jade_interp)) + 
      "</p><p>" + 
      (jade.escape(null == (jade_interp = bar) ? "" : jade_interp)) + 
      "</p><p>" + 
      (jade.escape(null == (jade_interp = bar.baz) ? "" : jade_interp)) + 
      "</p><h2>Bar</h2>");
  }.call(this,"bar" in locals_for_with?locals_for_with.bar:typeof bar!=="undefined"?bar:undefined,"foo" in locals_for_with?locals_for_with.foo:typeof foo!=="undefined"?foo:undefined));;return buf.join("");
    }
