var path = require("path");

module.exports = {
  output: {
    path: path.resolve(__dirname, '..', "build"),
    publicPath: "/build/",
    filename: "[name].js"
  },
  module: {
    loaders: [
      {test: /\.handlebars$/, loader: 'handlebars-loader'}
    ],
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
  babel: {
    plugins: ['transform-react-jsx'],
    presets: ['es2015'],
    sourceMaps: true
  }
};
