var _ = require('lodash');
var path = require('path');
var webpack = webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var baseConfig = require('./base.config.js')();

// this is the config for generating the files needed to run the examples.
module.exports = _.extend({}, baseConfig, {
  devtool: 'eval',
  entry: {
    "index": './example/index.js',
    "example": './example/example.js',
    "fullscheme-example": './example/fullscheme-example.js',
    "wescheme-example": './example/wescheme-example.js',
    "editor-example": './example/editor-example.js',
    "lambda-example": './example/languages/lambda.js',
    "third-party": ['react', 'react-dom', 'babel-polyfill', 'codemirror'],
  },
  module: _.extend({}, baseConfig.module, {
    loaders: baseConfig.module.loaders.concat([
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, '..', 'example'),
          path.resolve(__dirname, '..', 'src')
        ],
        loader: 'react-hot'
      },
      { test: /\.css$/, loaders: ["style", "css"] },
      { test: /\.rkt$/, loader: 'raw' }
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
    new HtmlWebpackPlugin({
      filename: 'languages/lambda.html',
      template: 'example/languages/lambda.html',
      inject: 'body',
      chunks: ['third-party','lambda-example'],
    }),
  ]),
  devServer: {
    hot: true,
    inline: true,
    progress: true,
    contentBase: path.join(__dirname, '..', 'example')
  }
});
