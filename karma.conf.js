// Karma configuration
// Generated on Mon Nov 30 2015 13:06:12 GMT-0800 (PST)
var webpackConfig = require('./webpack/test.config.js');
var envConfig = require('./env-config.js');
webpackConfig.devtool = 'inline-source-map';

// Configure frameworks and plugins:
// If we're not on Travis, add parallelism
// available frameworks: https://npmjs.org/browse/keyword/karma-adapter
var frameworks = ['jasmine', 'karma-typescript'];
var plugins = [
  'karma-sourcemap-loader',
  'karma-jasmine',
  'karma-coverage',
  'karma-chrome-launcher',
  'karma-webpack',
  'karma-typescript',
  'karma-coveralls'
];
if (!envConfig.isCI) {
  frameworks.unshift('parallel');
  plugins.unshift('karma-parallel');
}
// Configure reporters:
// if we're doing coverage, add the coverage reporter
// if we're on Travis, add the coveralls reporter, too
var reporters = ['dots'];
if (envConfig.runCoverage) {
  reporters.push('coverage');
  if (envConfig.isCI) {
    reporters.push('coveralls');
  }
}


console.log('reporters are', reporters);
console.log('frameworks are', frameworks);
console.log('plugins are', plugins);
module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    frameworks: frameworks,
    plugins: plugins,
    reporters: reporters,
    coverageReporter: {
      dir: '.coverage',
      reporters: [
        { type: 'html' },
        { type: 'lcovonly' }
      ]
    },

    parallelOptions: {
      executors: envConfig.isCI ? 1 : undefined, // undefined: defaults to cpu-count - 1
      shardStrategy: 'round-robin',
      // shardStrategy: 'description-length'
      // shardStrategy: 'custom'
      // customShardStrategy: function(config) {
      //   config.executors // number, the executors set above
      //   config.shardIndex // number, the specific index for the shard currently running
      //   config.description // string, the name of the top-level describe string. Useful 
      //     for determining how to shard the current specs
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
      // should we log console output in our test console?
      captureConsole: false,
      jasmine: {
        timeoutInterval: 30000
      }
    },

    jasmineDiffReporter: {
      pretty: true,
    },


    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_WARN,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    //browsers: [ envConfig.isCI ? 'ChromeTravisCI' : envConfig.devBrowser ],
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeTravisCI: {
        base: 'Chrome',
        flags: ['--no-sandbox', '--no-proxy-server', '--remote-debugging-port=9222']
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
