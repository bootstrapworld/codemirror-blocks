var _ = require('lodash');
var path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

var baseConfig = require('./base.config.js')();

// this is the config for generating the files needed to run the examples.
module.exports = function(env, argv) {
  return _.extend({}, baseConfig, {
    devtool: 'cheap-module-source-map',
    entry: {
      "new-editor-example": './example/new-editor-example.js',
      "new-pyret-editor-example": './example/new-pyret-editor-example.js'
    },
    module: _.extend({}, baseConfig.module, {
      rules: baseConfig.module.rules.concat([
        { test: /\.rkt$/, use: 'raw-loader' }
      ])
    }),
    plugins: baseConfig.plugins.concat([
      new webpack.HotModuleReplacementPlugin(),
      new HtmlWebpackPlugin({
        filename: 'new-editor.html',
        template: 'example/new-editor.html',
        inject: 'body',
        chunks: ['commons','new-editor-example'],
      }),
      new HtmlWebpackPlugin({
        filename: 'new-pyret-editor.html',
        template: 'example/new-pyret-editor.html',
        inject: 'body',
        chunks: ['commons','new-pyret-editor-example'],
      }),
      new webpack.IgnorePlugin(/analyzer|compiler|modules\.js/, /node_modules/),
    ]),
    optimization: {
      minimize: argv['mode'] == 'production',
      splitChunks: {
        cacheGroups: {
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            enforce: true
          }
        }
      }
    },
    devServer: {
      hot: true,
      inline: true,
      progress: true,
      contentBase: path.join(__dirname, '..', 'example')
    }
  });
}
