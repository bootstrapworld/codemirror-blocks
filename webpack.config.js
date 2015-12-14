var path = require("path");
var envConfig = require('./env-config.js');

var preLoaders = [];
if (envConfig.runCoverage) {
  preLoaders.push({
    test: /\.js/,
    loader: 'isparta',
    include: path.resolve(__dirname, 'src'),
    exclude: /node_modules/
  });
}

module.exports = {
  devtool: 'source-map',
  entry: {
    "example": './example/example.js',
    "wescheme-example": './example/wescheme-example.js'
  },
  output: {
    path: path.resolve(__dirname, "build"),
    publicPath: "/build/",
    filename: "[name].js"
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, 'example'),
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, 'node_modules', 'wescheme-js', 'src'),
          path.resolve(__dirname, 'spec')
        ],
        exclude: [
          path.resolve(__dirname, 'node_modules', 'wescheme-js', 'src', 'runtime', 'js-numbers.js')
        ],
        loader: "babel-loader"
      },
      { test: /\.less$/, loader: "style!css!less"},
      { test: /\.css$/, loaders: ["style", "css"] },
      { test: /\.rkt$/, loader: 'raw' },
      { test: /\.handlebars$/, loader: 'handlebars-loader'}
    ],
    preLoaders: preLoaders
  }
};
