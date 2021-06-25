import * as path from 'path';
import type { Configuration as WebpackConfiguration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import type { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';

type Configuration = WebpackConfiguration & {
  devServer?: WebpackDevServerConfiguration;
};

const siteDir = path.join(__dirname, 'dev-server', 'site');

function getBaseRules(): WebpackConfiguration['module']['rules'] {
  const rules: WebpackConfiguration['module']['rules'] = [];
  rules.push(
    {
      test:/.mp3$/, 
      use: [{ loader: "url-loader", options: { limit: 10000, esModule: false } }]
    }
  );
  rules.push({
    test: /\.less$|.css$/,
    use: [
      { loader: 'style-loader' },
      { loader: 'css-loader' },
      { loader: 'less-loader' },
    ],
  });

  rules.push({
    test: /\.(ts|tsx)$/,
    enforce: 'pre',
    use: {
      loader: 'ts-loader',
      options: { transpileOnly: true },
    },
  });

  rules.push({
    test: /\.(js|jsx)$/,
    enforce: 'pre',
    use: {
      loader: 'babel-loader',
      options: { cacheDirectory: true },
    },
  });

  return rules;
}

export function getBaseConfig(): WebpackConfiguration {
  return {
    module: {
      rules: getBaseRules(),
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

export function getBundleConfig(config: {
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

export function getDevServerConfig(config: { context: WebpackConfiguration['context'] }): Configuration {
  const baseConfig = getBaseConfig();
  return {
    ...baseConfig,
    name: 'devServer',
    mode: 'development',
    entry: './index.js',
    plugins: [
      ...baseConfig.plugins,
      // new webpack.HotModuleReplacementPlugin(),
      // new webpack.ProvidePlugin({
      //   process: 'process/browser',
      // }),
      new HtmlWebpackPlugin({
        template: path.resolve(siteDir, 'index.html'),
      }),
      // TODO(pcardune): this is broken... and probably unnecesary?
      // new webpack.IgnorePlugin(
      //   /analyzer|compiler|modules\.js/,
      //   /node_modules/
      // ),
    ],
    devtool: 'cheap-module-source-map',
    optimization: {
      runtimeChunk: true,
    },
    devServer: {
      hot: true,
      inline: true,
      host: '0.0.0.0', //your ip address
      disableHostCheck: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentBase: siteDir,
    },
    context: config.context,
  };
}

// this is the config for generating the files needed to run the examples.
export function getConfigs(config: {
  devServer: {
    context: WebpackConfiguration['context'];
  },
  bundle: {
    entry: WebpackConfiguration['entry'];
  };
}): Configuration[] {
  return [getBundleConfig(config.bundle), getDevServerConfig(config.devServer)];
}
