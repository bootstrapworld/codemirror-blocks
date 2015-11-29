var path = require("path");

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
          path.resolve(__dirname, 'node_modules', 'wescheme-js', 'src')
        ],
        loader: "babel-loader"
      },
      { test: /\.css$/, loaders: ["style", "css"] },
      { test: /\.rkt$/, loader: 'raw' },
      { test: /\.handlebars$/, loader: 'handlebars-loader'}
    ]
  }
};
