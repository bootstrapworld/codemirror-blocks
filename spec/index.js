// *Some* environments (phantomjs) don't have es5 (Function.prototype.bind)
require('@babel/polyfill');

// require all the files in the spec folder that end with -test.js
var context = require.context('.', true, /.-lab\.js$/);
context.keys().forEach(context);