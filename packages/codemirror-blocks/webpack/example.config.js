const path = require("path");
const {
  getWebpackDevServerConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

const config = getWebpackDevServerConfig({
  entry: "./editor-example.js",
  context: path.resolve(__dirname, "..", "example"),
});

// 1. Stub out testing libraries so Webpack purges them from production builds
config.resolve = config.resolve || {};
config.resolve.alias = {
  ...config.resolve.alias,
  "@testing-library/react": false,
  "@testing-library/dom": false,
  "@testing-library/jest-dom": false,
  "@testing-library/user-event": false,
};

// 2. Ensure Webpack resolves TypeScript file extensions
config.resolve.extensions = Array.from(
  new Set([...(config.resolve.extensions || []), ".ts", ".tsx", ".js", ".jsx"])
);

// 3. Add custom loaders
config.module.rules.push(
  {
    test: /\.rkt$/,
    type: "asset/source",
  },
  {
    test: /\.tsx?$/,
    use: [
      {
        loader: "ts-loader",
        options: {
          // Point directly to your custom tsconfig that excludes tests
          configFile: path.resolve(__dirname, "../tsconfig.build.json"),
        },
      },
    ],
    exclude: /node_modules/,
  }
);

module.exports = config;
