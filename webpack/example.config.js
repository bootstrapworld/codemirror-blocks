var _ = require('lodash');
var path = require('path');
var webpack = webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
/* 
  TODO(Emmanuel) - when webpack 4 comes out, we won't need to load this plugin separately
  See https://github.com/webpack-contrib/uglifyjs-webpack-plugin
 */
var UglifyJSPlugin = require('uglifyjs-webpack-plugin');
var baseConfig = require('./base.config.js')();

// this is the config for generating the files needed to run the examples.
module.exports = _.extend({}, baseConfig, {
  devtool: 'cheap-module-source-map',
  entry: {
    "index": './example/index.js',
    "example": './example/example.js',
    "fullscheme-example": './example/fullscheme-example.js',
    "wescheme-example": './example/wescheme-example.js',
    "editor-example": './example/editor-example.js',
    "third-party": ['react', 'react-dom', 'babel-polyfill', 'codemirror']
  },
  module: _.extend({}, baseConfig.module, {
    rules: baseConfig.module.rules.concat([
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
      { test: /\.rkt$/, use: 'raw-loader' }
    ])
  }),
  plugins: baseConfig.plugins.concat([
    new webpack.optimize.CommonsChunkPlugin({
      name:'third-party',
      minChunks: Infinity
    }),
    new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'example/index.html',
      inject: 'body',
      chunks: ['third-party','index'],
    }),
    new HtmlWebpackPlugin({
      filename: 'simple.html',
      template: 'example/simple.html',
      inject: 'body',
      chunks: ['third-party','example'],
    }),
    new HtmlWebpackPlugin({
      filename: 'fullscheme.html',
      template: 'example/fullscheme.html',
      inject: 'body',
      chunks: ['third-party','fullscheme-example'],
    }),
    new HtmlWebpackPlugin({
      filename: 'wescheme.html',
      template: 'example/wescheme.html',
      inject: 'body',
      chunks: ['third-party','wescheme-example'],
    }),
    new HtmlWebpackPlugin({
      filename: 'editor.html',
      template: 'example/editor.html',
      inject: 'body',
      chunks: ['third-party','editor-example'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new UglifyJSPlugin()
  ]),
  devServer: {
    hot: true,
    inline: true,
    progress: true,
    contentBase: path.join(__dirname, '..', 'example')
  }
});
