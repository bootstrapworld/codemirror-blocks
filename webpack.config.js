var path = require("path")

module.exports = {
  devtool: 'source-map',
  entry: {
    "example": './example/example.js'
  },
  output: {
    path: path.resolve(__dirname, "build"),
    publicPath: "/build/",
    filename: "[name].js"
  },
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"},
      { test: /\.css$/, loaders: ["style", "css"] }
    ]
  }
}