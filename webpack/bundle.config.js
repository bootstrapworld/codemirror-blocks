var _ = require('lodash');
var path = require('path');
var webpack = require('webpack');
var baseConfig = require('./base.config.js');

// this is the config for a single js file that can be included with a script tag
var configs = [
  _.extend({}, baseConfig(), {
    entry: {
      "CodeMirrorBlocks": ['./src/codemirror-blocks.js']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: "[name]"
    },
    externals: {
      'codemirror': 'CodeMirror'
    }
  }),
  // everything needed to drop into WeScheme
  _.extend({}, baseConfig(), {
    entry: {
      "CodeMirrorBlocks-wescheme": ['./src/languages/wescheme/index.js', './src/codemirror-blocks-all.js']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: "CodeMirrorBlocks",
    },
  }),
  _.extend({}, baseConfig(), {
    entry: {
      "WeschemeParser": ['./src/languages/wescheme/index.js']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "parsers/[name].js",
      library: ["CodeMirrorBlocks", "parsers", "[name]"]
    },
    externals: {
      'codemirror': 'CodeMirror',
      'ast': 'CodeMirrorBlocks.ast'
    }
  }),
  _.extend({}, baseConfig(), {
    entry: {
      "Editor": ['./src/languages/wescheme/index.js', './src/codemirror-blocks-all.js', './src/ui/']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: ["CodeMirrorBlocks"]
    },
    externals: {
      'codemirror': 'CodeMirror',
      'ast': 'CodeMirrorBlocks.ast'
    }
  })
];

configs = configs.concat(
  configs.map(function(config) {
    return _.merge({}, config, {
      output: {
        filename: "[name]-min.js"
      }
    });
  })
);

configs.push(
  _.extend({}, baseConfig({extractCSS:true}), {
    entry: {
      "blocks": './src/less/blocks.less'
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].css"
    },
  })
);
module.exports = configs;
