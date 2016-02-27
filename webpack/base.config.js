var path = require("path");
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = function(config) {
  config = config || {};
  var plugins = [];
  var loaders = [
    {test: /\.handlebars$/, loader: 'handlebars-loader?knownHelpers=renderNode'},
    {test:/.png$|.jpg$|.jpeg$|.gif$|.svg$/, loader: "url-loader?limit=10000"},
    {test:/.woff$|.woff2$/, loader: "url-loader?limit=10000"},
    {test:/.ttf$|.eot$/, loader: "file-loader"},
  ];
  if (config.extractCSS) {
    plugins.push(new ExtractTextPlugin("[name].css"));
    loaders.push({
      test: /\.less$/,
      loader: ExtractTextPlugin.extract("style-loader", ["css-loader", "less-loader"])
    });
  } else {
    loaders.push({test: /\.less$/, loader:'style!css!less'});
  }
  return {
    output: {
      path: path.resolve(__dirname, '..', "build"),
      filename: "[name].js"
    },
    module: {
      loaders: loaders,
      preLoaders: [{
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
        loader: "babel",
        query: {
          cacheDirectory: true
        }
      }]
    },
    plugins: plugins,
    babel: {
      plugins: ['transform-react-jsx'],
      presets: ['es2015'],
      sourceMaps: true
    }
  };
};
