// Karma configuration
// Generated on Mon Nov 30 2015 13:06:12 GMT-0800 (PST)
var webpackConfig = require('./webpack/test.config.js');
var envConfig = require('./env-config.js');
var reporters = ['jasmine-diff', 'dots'];

/*
if (envConfig.runCoverage) {
  reporters.push('coverage');

  if (envConfig.isCI) {
    reporters.push('coveralls');
  }
}
*/
module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['parallel', 'jasmine', 'karma-typescript'],

    parallelOptions: {
      // executors: , // Defaults to cpu-count - 1
      shardStrategy: 'round-robin'
      // shardStrategy: 'description-length'
      // shardStrategy: 'custom'
      // customShardStrategy: function(config) {
      //   config.executors // number, the executors set above
      //   config.shardIndex // number, the specific index for the shard currently running
      //   config.description // string, the name of the top-level describe string. Useful //     for determining how to shard the current specs
      //   return config.
      // }
    },

    // list of files / patterns to load in the browser
    files: [
      'spec/index.js',
    ],

    // list of files to exclude
    exclude: [
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      "spec/index.js": ["webpack", "sourcemap"],
    },

    karmaTypescriptConfig: {
      tsconfig: './tsconfig.json',
    },

    webpack: webpackConfig,
    webpackMiddleware: {
      noInfo: true
    },
    client: {
      // don't log console output in our test console
      captureConsole: false,
      jasmine: {
        timeoutInterval: 30000
      }
    },
    // reporters: ["karma-typescript"],
/*
    reporters: reporters,
    coverageReporter: {
      dir: '.coverage',
      reporters: [
        { type: 'html' },
        { type: 'lcovonly' }
      ]
    },
*/
    jasmineDiffReporter: {
      pretty: true,
    },


    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_ERROR,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: [ envConfig.isCI ? 'ChromeTravisCI' : envConfig.devBrowser ],
    customLaunchers: {
      ChromeTravisCI: {
        base: 'Chrome',
        flags: ['--no-sandbox']
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: envConfig.isCI,

    // Concurrency level
    // how many browser should be started simultanous
    concurrency: Infinity,
    captureTimeout: 60000,
    browserDisconnectTolerance: 3,
    browserDisconnectTimeout: 10000,
    browserNoActivityTimeout: 60000, // 60 seconds
  });
};
