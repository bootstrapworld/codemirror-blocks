import * as path from 'path';
import * as webpack from 'webpack';
import type { Config, ConfigOptions } from 'karma';
import 'karma-jasmine';
import 'karma-coverage';
import 'karma-parallel';
export {};
import { getBaseConfig } from './webpack';

type EnvConfig = {
  isCI: boolean;
  localDebug: boolean;
  runCoverage: boolean;
};

function getWebpackTestConfig(envConfig: EnvConfig): webpack.Configuration {
  const baseConfig = getBaseConfig();
  const coverageRules: webpack.Configuration['module']['rules'] = [];
  if (envConfig.runCoverage) {
    coverageRules.push({
      test: /\.js/,
      use: 'istanbul-instrumenter-loader',
      include: path.resolve(__dirname, '..', 'src'),
      exclude: [/(src\/languages|node_modules)/],
    });
  }

  return {
    ...baseConfig,
    mode: 'development',
    devtool: 'inline-source-map',
    module: {
      ...baseConfig.module,
      rules: [...baseConfig.module.rules, ...coverageRules],
    },
    plugins: [
      ...baseConfig.plugins,
      
      // For webpack5 (at least for now), we have to manually define this
      // the 'mode' setting on the line above seems to be ignored
      new webpack.DefinePlugin({
        'process.env': { NODE_ENV: JSON.stringify('development') },
      }),
    ],
  };
}

export function getConfigFunc(basePath: string, envConfig: EnvConfig) {
  // Configure frameworks and plugins:
  // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
  const frameworks = ['jasmine', 'webpack'];
  var plugins = [
    require('karma-sourcemap-loader'),
    require('karma-jasmine'),
    require('karma-chrome-launcher'),
    require('karma-webpack'),
    require('karma-coveralls'),
  ];

  // If we're not on Travis or trying to debug, add parallelism
  if (!(envConfig.isCI || envConfig.localDebug)) {
    frameworks.unshift('parallel');
    plugins.unshift(require('karma-parallel'));
  }
  // Configure reporters:
  // if we're doing coverage, add the coverage reporter
  // if we're on Travis, add the coveralls reporter, too
  var reporters = ['dots'];
  if (envConfig.runCoverage) {
    reporters.push('coverage');
    plugins.unshift(require('karma-coverage'));
    if (envConfig.isCI) {
      reporters.push('coveralls');
    }
  }

  return (config: Config) => {
    const karmaConfig: ConfigOptions = {
      // base path that will be used to resolve all patterns (eg. files, exclude)
      basePath: basePath,

      frameworks: frameworks,
      plugins: plugins,
      reporters: reporters,
      coverageReporter: {
        dir: '.coverage',
        reporters: [{ type: 'html' }, { type: 'lcovonly' }],
      },

      parallelOptions: {
        // undefined: defaults to cpu-count - 1
        executors: envConfig.isCI || envConfig.localDebug ? 1 : undefined,
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
        'spec/**/*-test.js',
        'spec/**/*-test.ts'
      ],

      exclude: ['/**/*ast*.ts'],

      // preprocess matching files before serving them to the browser
      // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
      preprocessors: {
        '**/*.ts': ['webpack', 'sourcemap'],
        'spec/index.js': ['webpack', 'sourcemap'],
        'src/*.js': ['webpack', 'sourcemap'],
      },


      // karmaTypescriptConfig: {
      //   tsconfig: './tsconfig.json',
      // },

      client: {
        // should we log console output in our test console?
        captureConsole: false || envConfig.localDebug,
        jasmine: {
          timeoutInterval: 30000,
        },
      },

      // web server port
      port: 9876,

      // enable / disable colors in the output (reporters and logs)
      colors: true,

      // level of logging
      // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
      logLevel: config.LOG_WARN,

      // enable / disable watching file and executing tests whenever any file changes
      // wait half a second before re-running
      autoWatch: true,
      autoWatchBatchDelay: 500,

      // start these browsers
      // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
      browsers: ['ChromeHeadless'],
      customLaunchers: {
        ChromeTravisCI: {
          base: 'Chrome',
          flags: [
            '--no-sandbox',
            '--no-proxy-server',
            '--remote-debugging-port=9222',
          ],
        },
      },

      // Continuous Integration mode
      // if true, Karma captures browsers, runs the tests and exits
      singleRun: envConfig.isCI,

      // Concurrency level
      // how many browser should be started simultanous
      concurrency: envConfig.isCI || envConfig.localDebug ? 4 : Infinity,
      captureTimeout: 60000,
      browserDisconnectTolerance: 3,
      browserDisconnectTimeout: 10000,
      browserNoActivityTimeout: 60000, // 60 seconds
    };

    config.set({
      ...karmaConfig,

      // options for karma-webpack
      webpack: getWebpackTestConfig(envConfig),
      webpackMiddleware: {
        noInfo: true,
      },

      // options for karma-jasmine-diff-reporter
      jasmineDiffReporter: {
        pretty: true,
      },
    } as any);
  };
}
