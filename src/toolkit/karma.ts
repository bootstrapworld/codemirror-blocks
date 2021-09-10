import * as path from "path";
import * as webpack from "webpack";
import type { Config, ConfigOptions } from "karma";
import "karma-jasmine";
import "karma-coverage";
import "karma-parallel";
import { getBaseConfig } from "./webpack";

function getWebpackTestConfig(
  basePath: string,
  runCoverage: boolean
): webpack.Configuration {
  const baseConfig = getBaseConfig();
  const coverageRules: webpack.Configuration["module"]["rules"] = [];
  if (runCoverage) {
    coverageRules.push({
      test: /(\.js|\.ts)/,
      use: {
        loader: "istanbul-instrumenter-loader",
        options: {
          esModules: true,
        },
      },
      include: path.resolve(basePath, "src"),
      enforce: "post",
    });
  }

  return {
    ...baseConfig,
    mode: "development",
    devtool: "inline-source-map",
    module: {
      ...baseConfig.module,
      rules: [...baseConfig.module.rules, ...coverageRules],
    },
    plugins: [
      ...baseConfig.plugins,

      // For webpack5 (at least for now), we have to manually define this
      // the 'mode' setting on the line above seems to be ignored
      new webpack.DefinePlugin({
        "process.env": { NODE_ENV: JSON.stringify("development") },
      }),
    ],
    // TODO: remove this workaround to sourcemaps being broken in
    // karma-webpack version 5. See this github issue:
    // https://github.com/ryanclark/karma-webpack/issues/493
    optimization: {
      splitChunks: false,
    },
  };
}

/**
 * Creates a karma config object for use with the karma test runner.
 * Just call this function inside your projects karma.conf.js file like
 * shown in the example below.
 *
 * @example
 * ```typescript
 * // karma.conf.js
 * const {getKarmaConfig} = require('codemirror-blocks/lib/toolkit/karma');
 * module.exports = (config) => {
 *   config.set(getKarmaConfig(config, __dirname));
 * };
 * ```
 * @param basePath This should always be the absolute path to the root
 * directory where your karma.conf.js file lives
 * @returns
 */
export function getKarmaConfig(config: Config, basePath: string) {
  const envConfig = {
    isCI: process.env.CONTINUOUS_INTEGRATION === "true",
    runCoverage: process.env.COVERAGE === "true",
    localDebug: process.env.DEBUG === "true",
  };

  // Configure frameworks and plugins:
  // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
  const frameworks = ["jasmine", "webpack"];
  var plugins = [
    require("karma-sourcemap-loader"),
    require("karma-jasmine"),
    require("karma-chrome-launcher"),
    require("karma-webpack"),
    require("karma-coveralls"),
  ];

  // If we're not on Travis or trying to debug, add parallelism
  if (!envConfig.localDebug) {
    frameworks.unshift("parallel");
    plugins.unshift(require("karma-parallel"));
  }
  // Configure reporters:
  // if we're doing coverage, add the coverage reporter
  // if we're on Travis, add the coveralls reporter, too
  var reporters = ["dots"];
  if (envConfig.runCoverage) {
    reporters.push("coverage");
    plugins.unshift(require("karma-coverage"));
    if (envConfig.isCI) {
      reporters.push("coveralls");
    }
  }

  const karmaConfig: ConfigOptions = {
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: basePath,

    frameworks: frameworks,
    plugins: plugins,
    reporters: reporters,
    coverageReporter: {
      dir: ".coverage",
      reporters: [{ type: "html" }, { type: "lcovonly" }],
    },

    parallelOptions: {
      // undefined: defaults to cpu-count - 1
      executors: envConfig.isCI || envConfig.localDebug ? 1 : undefined,
      shardStrategy: "round-robin",
    },

    // list of files / patterns to load in the browser
    files: ["spec/**/*-test.js", "spec/**/*-test.ts"],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      "spec/**/*.js": ["webpack", "sourcemap"],
      "spec/**/*.ts": ["webpack", "sourcemap"],
      "src/**/*.js": ["webpack", "sourcemap"],
      "src/**/*.ts": ["webpack", "sourcemap"],
    },

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
    browsers: ["ChromeHeadless"],
    customLaunchers: {
      ChromeTravisCI: {
        base: "Chrome",
        flags: [
          "--no-sandbox",
          "--no-proxy-server",
          "--remote-debugging-port=9222",
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

  return {
    ...karmaConfig,

    // options for karma-webpack
    webpack: getWebpackTestConfig(basePath, envConfig.runCoverage),
    webpackMiddleware: {
      noInfo: true,
    },

    // options for karma-jasmine-diff-reporter
    jasmineDiffReporter: {
      pretty: true,
    },
  };
}
