// *Some* environments (phantomjs) don't have es5 (Function.prototype.bind)
require('@babel/polyfill');
// require('babel-polyfill');

// require all the files in the spec folder that end with -test.js
var context = require.context('./languages/pyret/', true, /-test\.js$/);
context.keys().forEach(context);

// require all the files in the spec/docs folder that end with .js
//context = require.context('./docs', true, /.*.js$/);
//context.keys().forEach(context);
