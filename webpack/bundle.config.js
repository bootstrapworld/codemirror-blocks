var _ = require('lodash');
var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var baseConfig = require('./base.config.js');

// this is the config for a single js file that can be included with a script tag
var configs = [
  _.extend({}, baseConfig, {
    entry: {
      "CodeMirrorBlocks": './src/codemirror-blocks.js'
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: "[name]"
    },
    externals: {
      'codemirror': 'CodeMirror'
    }
  }),
  _.extend({}, baseConfig, {
    entry: {
      "WeschemeParser": './src/parsers/wescheme.js'
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "parsers/[name].js",
      library: ["CodeMirrorBlocks", "parsers", "[name]"]
    },
    externals: {
      'codemirror': 'CodeMirror',
      '../ast': 'CodeMirrorBlocks.ast'
    }
  })
];

configs = configs.concat(
  configs.map(function(config) {
    return _.merge({}, config, {
      output: {
        filename: "[name].min.js"
      },
      plugins: [
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin({
          compressor: {
            warnings: false
          }
        })
      ]
    });
  })
);

configs.push(
  _.extend({}, baseConfig, {
    entry: {
      "example": './src/less/example.less'
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].css"
    },
    module: _.extend({}, baseConfig.module, {
      loaders: baseConfig.module.loaders.concat([
        {
          test: /\.less$/,
          loader: ExtractTextPlugin.extract("style-loader", ["css-loader", "less-loader"])
        }
      ])
    }),
    plugins: [
      new ExtractTextPlugin("[name].css")
    ]
  })
);
module.exports = configs;
