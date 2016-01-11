var _ = require('lodash');
var baseConfig = require('./base.config.js');

// this is the config for generating the files needed to run the examples.
module.exports = _.extend({}, baseConfig, {
  devtool: 'source-map',
  entry: {
    "example": './example/example.js',
    "wescheme-example": './example/wescheme-example.js'
  },
  module: _.extend({}, baseConfig.module, {
    loaders: baseConfig.module.loaders.concat([
      { test: /\.less$/, loader: "style!css!less"},
      { test: /\.css$/, loaders: ["style", "css"] },
      { test: /\.rkt$/, loader: 'raw' }
    ])
  })
});
