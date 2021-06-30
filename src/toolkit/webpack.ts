import * as path from 'path';
import type { Configuration as WebpackConfiguration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

/**
 * @internal
 */
export function getBaseConfig(): WebpackConfiguration {
  return {
    module: {
      rules: [
        {
          test: /.mp3$/,
          use: [
            {
              loader: 'url-loader',
              options: { limit: 10000, esModule: false },
            },
          ],
        },
        {
          test: /\.less$|.css$/,
          use: [
            { loader: 'style-loader' },
            { loader: 'css-loader' },
            { loader: 'less-loader' },
          ],
        },
        {
          test: /\.(ts|tsx)$/,
          enforce: 'pre',
          use: {
            loader: 'ts-loader',
            options: { transpileOnly: true },
          },
        },
        {
          test: /\.(js|jsx)$/,
          enforce: 'pre',
          use: {
            loader: 'babel-loader',
            options: { cacheDirectory: true },
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'], // Order matters!
    },
    resolveLoader: {
      modules: [
        'node_modules',
        path.resolve(__dirname, '..', '..', 'node_modules'),
      ],
    },
    devtool: 'cheap-module-source-map',
    plugins: [],
  };
}

/**
 * Creates a webpack configuration suitable for generating a minified
 * javascript bundle file that can be included with a `<script>` tag.
 * See [the webpack documentation](https://webpack.js.org/configuration/entry-context/)
 * for details about the entry config option.
 * @param config.entry the entrypoint(s) for the webpack bundle
 * @returns a webpack configuration object
 */
export function getWebpackBundleConfig(config: {
  entry: WebpackConfiguration['entry'];
}): WebpackConfiguration {
  const baseConfig = getBaseConfig();
  return {
    ...baseConfig,
    entry: config.entry,
    name: 'bundle',
    mode: 'production',
    output: {
      filename: '[name]-min.js',
      clean: true,
      library: {
        name: 'CodemirrorBlocks',
        type: 'umd',
      },
    },
    plugins: [
      ...baseConfig.plugins,
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: 'bundle-sizes.html',
        generateStatsFile: true,
        openAnalyzer: false,
      }),
    ],
    externals: {
      codemirror: 'codemirror',
      'codemirror/addon/search/search': 'codemirror',
      'codemirror/addon/search/searchcursor': 'codemirror',
    },
    optimization: {
      minimize: true,
    },
  };
}

/**
 * Creates a webpack configuration suitable for use with the `webpack serve`
 * command. See [the webpack documentation](https://webpack.js.org/configuration/entry-context/)
 * for details about the entry and context config options.
 * 
 * @param config.entry entry file to load.
 * @param config.context path to the directory containing the entry files.
 * @returns a webpack configuration object.
 */
export function getWebpackDevServerConfig(config: {
  entry: WebpackConfiguration['entry'];
  context: WebpackConfiguration['context'];
}): WebpackConfiguration & {
  devServer?: WebpackDevServerConfiguration;
} {
  const siteDir = path.join(__dirname, 'dev-server', 'site');
  const baseConfig = getBaseConfig();
  return {
    ...baseConfig,
    name: 'devServer',
    mode: 'development',
    context: config.context,
    entry: config.entry,
    plugins: [
      ...baseConfig.plugins,
      new HtmlWebpackPlugin({
        template: path.resolve(siteDir, 'index.html'),
      }),
    ],
    devtool: 'cheap-module-source-map',
    optimization: {
      runtimeChunk: true,
    },
    devServer: {
      hot: true,
      inline: true,
      host: '0.0.0.0',
      disableHostCheck: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentBase: siteDir,
    },
  };
}
