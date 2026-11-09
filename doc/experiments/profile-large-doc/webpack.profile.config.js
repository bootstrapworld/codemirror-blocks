// Dev-server config for profiling: React and friends in production mode (the
// development build of React is several times slower and says little about
// real use), unminified so function names show in the CPU profile, and split
// into named chunks so profile frames can be attributed by file.
// Run from packages/codemirror-blocks:
//   npx webpack serve --config ../../doc/experiments/profile-large-doc/webpack.profile.config.js --port 8201
const base = require("../../../packages/codemirror-blocks/webpack/example.config.js");

const group = (name, test, priority = 20) => ({
  name,
  test,
  chunks: "all",
  priority,
  enforce: true,
});

module.exports = {
  ...base,
  mode: "production",
  devtool: false,
  performance: { hints: false },
  devServer: { ...base.devServer, client: { overlay: false } },
  optimization: {
    minimize: false,
    concatenateModules: false,
    runtimeChunk: "single",
    splitChunks: {
      cacheGroups: {
        // (with CMB_PREACT=1, Preact and the module that aliases react to it)
        react: group(
          "v-react",
          /[\\/](node_modules[\\/](react|react-dom|scheduler|preact)[\\/]|webpack[\\/]preact-compat\.js)/
        ),
        redux: group(
          "v-redux",
          /[\\/]node_modules[\\/](redux|react-redux|@reduxjs|reselect|immer|use-sync-external-store)[\\/]/
        ),
        cm: group("v-codemirror", /[\\/]node_modules[\\/]codemirror[\\/]/),
        other: group("v-other", /[\\/]node_modules[\\/]/, 10),
      },
    },
  },
};
