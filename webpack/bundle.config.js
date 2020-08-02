var _ = require('lodash');
var path = require('path');
var webpack = require('webpack');
var baseConfig = require('./base.config.js');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// this is the config for a single js file that can be included with a script tag
var configs = [
  _.extend({}, baseConfig(), {
    resolve : {
      alias: { 
        "react": "preact/compat",
        "react-dom/test-utils": "preact/test-utils",
        "react-dom": "preact/compat",
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    }, 
    entry: {
      "CodeMirrorBlocks": ['./src/CodeMirrorBlocks.js']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: "CodeMirrorBlocks",
      libraryTarget: 'umd',
    },
    plugins: [
      new webpack.ProvidePlugin({ codemirror: "codemirror" }),
      new BundleAnalyzerPlugin({
        analyzerMode: 'static', 
        openAnalyzer: !('TRAVIS' in process.env && 'CI' in process.env),
        reportFilename: "bundle-sizes.html",
        generateStatsFile: true,
        openAnalyzer: false,
      }),
    ],
    externals: {
      'codemirror': 'codemirror',
      'codemirror/addon/search/search' : 'codemirror/addon/search/search',
      'codemirror/addon/search/searchcursor' : 'codemirror/addon/search/searchcursor'
    },
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
