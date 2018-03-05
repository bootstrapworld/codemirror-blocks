var path = require("path");
var _ = require('lodash');
var baseConfig = require('./base.config.js')();
var envConfig = require('../env-config.js');

var rules = baseConfig.module.rules.concat();
if (envConfig.runCoverage) {
  rules.push({
    test: /\.js/,
    use: 'istanbul-instrumenter-loader',
    include: path.resolve(__dirname, '..', 'src'),
    exclude: /node_modules/
  });
}

// this is the config for generating the files needed to run the examples.
module.exports = _.extend({}, baseConfig, {
  resolve: {
    alias: {
      'codemirror-blocks': path.resolve(__dirname, '..', 'src')
    },
  },
  devtool: 'inline-source-map',
  module: _.extend({}, baseConfig.module, {
    rules: rules
  })
});
