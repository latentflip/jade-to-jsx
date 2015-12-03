#!/usr/bin/env node

var compile = require('./index');
var filename = process.argv[2];
var path = require('path');

console.log(compile({
    filename: path.join(process.cwd(), filename)
}));
