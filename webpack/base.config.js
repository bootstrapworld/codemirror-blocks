const path = require("path");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const envConfig = require('../env-config.js');

module.exports = function(config) {
  config = config || {};
  var plugins = [];
  var rules = [
    {
      test:/.woff$|.woff2.png$|.jpg$|.jpeg$|.gif$|.svg$|.wav$/, 
      use: { loader: "url-loader", options: { limit: 10000 } }
    },
    {test:/.ttf$|.eot$/, use: "file-loader"},
    {test:/\.css$/, use: [{loader:"style-loader"},{loader:"css-loader"}] },
  ];
  if (config.extractCSS) {
    plugins.push(new MiniCssExtractPlugin({ filename: '[name].[chunkhash].css' }),);
    rules.push({
      test: /\.less$/,
      use: [MiniCssExtractPlugin.loader, "css-loader", "less-loader"]
    });
  } else {
    rules.push({
      test: /\.less$/, 
      use:[{loader:"style-loader"},{loader:"css-loader"},{loader:"less-loader"}]
    });
  }
  return {
    resolve : {
      extensions: ['.ts', '.tsx', '.js', '.jsx'], // Order matters!
    },
    output: {
      path: path.resolve(__dirname, '..', "build"),
      filename: "[name].js"
    },
    mode: envConfig.isCI? "development" : "production",
    module: {
      rules: rules.concat([
        {
          test: /\.(ts|tsx)$/,
          include: [
            path.resolve(__dirname, '..', 'example'),
            path.resolve(__dirname, '..', 'src'),
            path.resolve(__dirname, '..', 'spec')
          ],
          use: "ts-loader",
        },
        {
          test: /\.(js|jsx)$/,
          include: [
            path.resolve(__dirname, '..', 'example'),
            path.resolve(__dirname, '..', 'src'),
            path.resolve(__dirname, '..', 'node_modules', 'wescheme-js', 'src'),
            path.resolve(__dirname, '..', 'spec')
          ],
          exclude: [
            path.resolve(__dirname, '..', 'node_modules', 'wescheme-js', 'src', 'runtime', 'js-numbers.js')
          ],
          enforce: "pre",
          use: {
            loader: "babel-loader",
            options: {cacheDirectory: true},
          }
        },
        {
          test: /\.css$/,
          include: [path.resolve(__dirname, '..', 'spec')],
          use: [{loader: 'style-loader'}, {loader: 'css-loader'}]
        }
    ])
    },
    plugins: plugins,
  }
};
