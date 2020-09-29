// Karma configuration
// Generated on Mon Nov 30 2015 13:06:12 GMT-0800 (PST)
var webpackConfig = require('./webpack/test.config.js');
var envConfig = require('./env-config.js');

// Configure frameworks and plugins:
// available frameworks: https://npmjs.org/browse/keyword/karma-adapter
var frameworks = ['jasmine'];
var plugins = [
  'karma-sourcemap-loader',
  'karma-jasmine',
  'karma-chrome-launcher',
  'karma-webpack',
  'karma-coveralls'
];
// If we're not on Travis, add parallelism
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
  plugins.unshift( 'karma-coverage')
  if (envConfig.isCI) {
    reporters.push('coveralls');
  }
}

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
      captureConsole: true,
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

    exclude: ['actions.js'],

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

    exclude: ["/**/*ast*.ts"],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: envConfig.isCI,

    // Concurrency level
    // how many browser should be started simultanous
    concurrency: 4,
    captureTimeout: 60000,
    browserDisconnectTolerance: 3,
    browserDisconnectTimeout: 10000,
    browserNoActivityTimeout: 60000, // 60 seconds
  });
};
