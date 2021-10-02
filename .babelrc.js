module.exports = {
  plugins: [
    "react-hot-loader/babel",
    "@babel/plugin-transform-modules-commonjs",
  ],
  exclude: ["/\bcore-js\b/"],
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          browsers: [
            "Firefox >= 76",
            "Safari >= 13",
            "Chrome >= 85",
            "Edge >= 85",
          ],
        },
        useBuiltIns: "entry",
        corejs: {
          version: "3",
        },
      },
    ],
    "@babel/preset-react",
    [
      "@babel/preset-typescript",
      {
        allowDeclareFields: true,
      },
    ],
  ],
  sourceMaps: true,
};
