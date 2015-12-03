#!/usr/bin/env node

var compile = require('./index');
var filename = process.argv[2];
var path = require('path');
var nopt = require('nopt');

var knownOpts = {
    replace: [path, Array],
    with: [String, Array]
};

var shortOpts = {
    'r': ['--replace'],
    'w': ['--with']
};

var parsed = nopt(knownOpts, shortOpts, process.argv);
var replace = parsed.replace || [];
var replaceWith = parsed['with'] || [];
var filename = parsed.argv.remain[0];

if (!filename) {
    throw new Error('A filename to convert is required');
}

if (replace.length !== replaceWith.length) {
    throw new Error('Must have same number of --replace as --with');
}

var replacements = replace.reduce(function (obj, key, i) {
    obj[key] = replaceWith[i];
    return obj;
}, {});

console.log(compile({
    filename: path.join(process.cwd(), filename),
    replacements: replacements
}));
