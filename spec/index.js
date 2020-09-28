// require all the files in the spec folder that end with -test.js
var context = require.context('.', true, /.activation-test\.js$/);
context.keys().forEach(context);