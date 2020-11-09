const path = require("path");
const baseConfig = require('./base.config.js')();
const envConfig = require('../env-config.js');
const webpack = require('webpack');

const rules = baseConfig.module.rules.concat();
if (envConfig.runCoverage) {
  rules.push({
    test: /\.js/,
    use: 'istanbul-instrumenter-loader',
    include: path.resolve(__dirname, '..', 'src'),
    exclude: /node_modules/
  });
}

// For webpack5 (at least for now), we have to manually define this
// the 'mode' setting on the line above seems to be ignored
const plugins = baseConfig.plugins.concat();
plugins.push(new webpack.DefinePlugin({
  'process.env': { NODE_ENV: JSON.stringify('development') }
}));

envConfig.travis = ('TRAVIS' in process.env && 'CI' in process.env);

// this is the config for generating the files needed to run the examples.
module.exports = Object.assign({}, baseConfig, {
  resolve: {
    alias: {
      'codemirror-blocks': path.resolve(__dirname, '..', 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  devtool: 'inline-source-map',
  module: Object.assign({}, baseConfig.module, {
    rules: rules
  }),
  mode: 'development',
  output: { filename: '[name].js' },
  // Work around webpack 4 compatibility issues:
  // https://github.com/webpack-contrib/karma-webpack/issues/322
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  plugins: plugins,
});