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
      "index": './example/index.js',
      "example": './example/example.js',
      "fullscheme-example": './example/fullscheme-example.js',
      "cow-game": './example/cow-game.js',
      "space-invaders": './example/space-invaders.js',
      "wescheme-example": './example/wescheme-example.js',
      "editor-example": './example/editor-example.js'
    },
    module: _.extend({}, baseConfig.module, {
      rules: baseConfig.module.rules.concat([
        { test: /\.css$/, use: ["style-loader", "css-loader"] },
        { test: /\.rkt$/, use: 'raw-loader' }
      ])
    }),
    plugins: baseConfig.plugins.concat([
      new webpack.HotModuleReplacementPlugin(),
      new HtmlWebpackPlugin({
        filename: 'index.html',
        template: 'example/index.html',
        inject: 'body',
        chunks: ['commons', 'index'],
      }),
      new HtmlWebpackPlugin({
        filename: 'simple.html',
        template: 'example/simple.html',
        inject: 'body',
        chunks: ['commons', 'example'],
      }),
      new HtmlWebpackPlugin({
        filename: 'fullscheme.html',
        template: 'example/fullscheme.html',
        inject: 'body',
        chunks: ['commons', 'fullscheme-example'],
      }),
      new HtmlWebpackPlugin({
        filename: 'cow-game.html',
        template: 'example/cow-game.html',
        inject: 'body',
        chunks: ['commons', 'cow-game'],
      }),
      new HtmlWebpackPlugin({
        filename: 'space-invaders.html',
        template: 'example/space-invaders.html',
        inject: 'body',
        chunks: ['commons', 'space-invaders'],
      }),
      new HtmlWebpackPlugin({
        filename: 'wescheme.html',
        template: 'example/wescheme.html',
        inject: 'body',
        chunks: ['commons', 'wescheme-example'],
      }),
      new HtmlWebpackPlugin({
        filename: 'editor.html',
        template: 'example/editor.html',
        inject: 'body',
        chunks: ['commons','editor-example'],
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