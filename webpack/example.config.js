var _ = require('lodash');
var path = require('path');
var webpack = webpack = require('webpack');
var baseConfig = require('./base.config.js')();

// this is the config for generating the files needed to run the examples.
module.exports = _.extend({}, baseConfig, {
  devtool: 'eval',
  entry: {
    "index": './example/index.js',
    "example": './example/example.js',
    "wescheme-example": './example/wescheme-example.js',
    "editor-example": './example/editor-example.js',
    "third-party": ['react', 'react-dom', 'babel-polyfill', 'codemirror']
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
    new webpack.HotModuleReplacementPlugin()
  ]),
  devServer: {
    hot: true,
    inline: true,
    progress: true,
    contentBase: path.join(__dirname, '..', 'example')
  }
});
