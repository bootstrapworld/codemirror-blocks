const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const baseConfig = require('./base.config.js')();

// this is the config for generating the files needed to run the examples.
module.exports = function(env, argv) {

  return Object.assign({}, baseConfig, {
    entry: {
      "new-editor-example": './example/new-editor-example.js',
    },
    module: Object.assign({}, baseConfig.module, {
      rules: baseConfig.module.rules.concat([
        { test: /\.rkt$/, use: 'raw-loader' },
        { test: /\.arr$/, use: 'raw-loader' }
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
      new webpack.IgnorePlugin(/analyzer|compiler|modules\.js/, /node_modules/)
    ]),
    optimization: {
      minimize: argv['mode'] == 'production',
      splitChunks: false,
    },
    devServer: {
      hot: true,
      inline: true,
      progress: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentBase: path.join(__dirname, '..', 'example')
    },
  });
}
