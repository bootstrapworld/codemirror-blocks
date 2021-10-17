const { getKarmaConfig } = require("codemirror-blocks/lib/toolkit/karma");

module.exports = (config) => {
  const karmaConfig = getKarmaConfig(config, __dirname);

  // Add aliases needed by WeschemeParser.js
  // TODO(pcardune): stop using aliases and just import
  // directly from the right place...?
  karmaConfig.webpack.resolve.alias = {
    jsnums: "wescheme-js/src/runtime/js-numbers",
    lex: "wescheme-js/src/lex",
    types: "wescheme-js/src/runtime/types",
    structs: "wescheme-js/src/structures",
  };
  config.set(karmaConfig);
};
