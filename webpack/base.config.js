const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const envConfig = require("../env-config.js");

module.exports = function (config) {
  config = config || {};
  var plugins = [];
  var rules = [
    {
      test: /.woff$|.woff2.png$|.jpg$|.jpeg$|.gif$|.svg$|.wav$|.mp3$/,
      use: [
        { loader: "url-loader", options: { limit: 10000, esModule: false } },
      ],
    },
    {
      test: /.ttf$|.eot$/,
      use: [{ loader: "file-loader" }],
    },
    {
      test: /\.rkt$/,
      use: [{ loader: "raw-loader" }],
    },
    {
      test: /\.arr$/,
      use: [{ loader: "raw-loader" }],
    },
  ];
  if (config.extractCSS) {
    plugins.push(
      new MiniCssExtractPlugin({
        filename: "[name].css",
        chunkFilename: "[name].css",
      })
    );
    rules.push({
      test: /\.less$|.css$/,
      use: [
        { loader: MiniCssExtractPlugin.loader },
        { loader: "css-loader" },
        { loader: "less-loader" },
      ],
    });
  } else {
    rules.push({
      test: /\.less$|.css$/,
      use: [
        { loader: "style-loader" },
        { loader: "css-loader" },
        { loader: "less-loader" },
      ],
    });
  }
  return {
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"], // Order matters!
    },
    output: {
      path: path.resolve(__dirname, "..", "build"),
      //filename: "[name].js" // commented out for karma to work, and seems unecessary!
    },
    devtool: "cheap-module-source-map",
    mode: envConfig.isCI ? "development" : "production",
    module: {
      rules: rules.concat([
        {
          test: /\.(ts|tsx)$/,
          include: [
            path.resolve(__dirname, "..", "example"),
            path.resolve(__dirname, "..", "src"),
            path.resolve(__dirname, "..", "spec"),
          ],
          use: [
            {
              loader: "ts-loader",
              options: { transpileOnly: true },
            },
          ],
        },
        {
          test: /\.(js|jsx)$/,
          include: [
            path.resolve(__dirname, "..", "example"),
            path.resolve(__dirname, "..", "src"),
            path.resolve(__dirname, "..", "node_modules", "wescheme-js", "src"),
            path.resolve(__dirname, "..", "spec"),
          ],
          exclude: [
            path.resolve(
              __dirname,
              "..",
              "node_modules",
              "wescheme-js",
              "src",
              "runtime",
              "js-numbers.js"
            ),
          ],
          enforce: "pre",
          use: {
            loader: "babel-loader",
            options: { cacheDirectory: true },
          },
        },
        {
          test: /\.css$/,
          include: [path.resolve(__dirname, "..", "spec")],
          use: [{ loader: "style-loader" }, { loader: "css-loader" }],
        },
      ]),
    },
    plugins: plugins,
  };
};
