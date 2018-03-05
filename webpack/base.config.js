var path = require("path");
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = function(config) {
  config = config || {};
  var plugins = [];
  var rules = [
    {test:/.png$|.jpg$|.jpeg$|.gif$|.svg$|.wav$/, use: "url-loader?limit=10000"},
    {test:/.woff$|.woff2$/, use: "url-loader?limit=10000"},
    {test:/.ttf$|.eot$/, use: "file-loader"},
  ];
  if (config.extractCSS) {
    plugins.push(new ExtractTextPlugin("[name].css"));
    rules.push({
      test: /\.less$/,
      use: ExtractTextPlugin.extract({fallback:"style-loader", use:["css-loader", "less-loader"]})
    });
  } else {
    rules.push({test: /\.less$/, use:["style-loader","css-loader","less-loader"]});
  }
  return {
    output: {
      path: path.resolve(__dirname, '..', "build"),
      filename: "[name].js"
    },
    module: {
      rules: rules.concat([{
        test: /\.js$/,
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
        loader: "babel-loader",
        query: {
          cacheDirectory: true
        }
      }])
    },
    plugins: plugins,
  };
};
