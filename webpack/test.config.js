var path = require("path");
var _ = require('lodash');
var baseConfig = require('./base.config.js')();
var envConfig = require('../env-config.js');

var preLoaders = baseConfig.module.preLoaders.concat();
if (envConfig.runCoverage) {
  preLoaders.push({
    test: /\.js/,
    loader: 'isparta',
    include: path.resolve(__dirname, '..', 'src'),
    exclude: /node_modules/
  });
}

// this is the config for generating the files needed to run the examples.
module.exports = _.extend({}, baseConfig, {
  devtool: 'inline-source-map',
  module: _.extend({}, baseConfig.module, {
    preLoaders: preLoaders
  })
});
