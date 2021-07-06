const path = require('path');
const {getKarmaConfig} = require('./lib/toolkit/karma');

module.exports = (config) => {
  const toolkitConfig = getKarmaConfig(__dirname);
  toolkitConfig.webpack.resolve.alias = {
    'codemirror-blocks': path.resolve(__dirname, 'src'),
  };
  toolkitConfig.files = ["spec/index.js"];
  config.set(toolkitConfig);
};