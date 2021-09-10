const path = require("path");
const { getKarmaConfig } = require("./lib/toolkit/karma");

module.exports = (config) => {
  const toolkitConfig = getKarmaConfig(__dirname);
  toolkitConfig.webpack.resolve.alias = {
    "codemirror-blocks": path.resolve(__dirname, "src"),
  };
  config.set(toolkitConfig);
};
