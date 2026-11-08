import * as path from "path";
import type {
  Configuration as WebpackConfiguration,
  ExternalItem,
} from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
// webpack-dev-server 6 is an ES module; this file is CommonJS, and only the type
// is needed, so say which way to resolve it.
import type { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server" with {
  "resolution-mode": "import",
};

/**
 * @internal
 */
export function getBaseConfig(): WebpackConfiguration {
  return {
    module: {
      rules: [
        {
          test: /\.less$|.css$/,
          use: [
            { loader: "style-loader" },
            { loader: "css-loader" },
            { loader: "less-loader" },
          ],
        },
        {
          test: /\.(ts|tsx)$/,
          enforce: "pre",
          use: {
            loader: "ts-loader",
            options: { transpileOnly: true },
          },
        },
        {
          test: /\.(js|jsx)$/,
          enforce: "pre",
          use: {
            loader: "babel-loader",
            options: { cacheDirectory: true },
          },
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"], // Order matters!
    },
    resolveLoader: {
      modules: [
        "node_modules",
        // the workspace root, where npm hoists the loaders (this file is in
        // packages/cmb-toolkit/src, and compiled into packages/cmb-toolkit/lib)
        path.resolve(__dirname, "..", "..", "..", "node_modules"),
      ],
    },
    // TypeScript is compiled by ts-loader (above). Newer versions of webpack
    // can also strip types natively, but that doesn't handle .tsx files.
    experiments: { typescript: false },
    devtool: "cheap-module-source-map",
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
  entry: WebpackConfiguration["entry"];
}): WebpackConfiguration {
  const baseConfig = getBaseConfig();
  return {
    ...baseConfig,
    entry: config.entry,
    name: "bundle",
    mode: "production",
    output: {
      filename: "[name]-min.js",
      clean: true,
      library: {
        name: "CodeMirrorBlocks",
        type: "umd",
        export: "default",
      },
    },
    plugins: [
      ...(baseConfig.plugins ?? []),
      new BundleAnalyzerPlugin({
        analyzerMode: "static",
        reportFilename: "bundle-sizes.html",
        generateStatsFile: true,
        openAnalyzer: false,
      }),
    ],
    // CodeMirror 5 is loaded by the page, with its own <script> tag, as the global
    // `CodeMirror` (and its addons add to it)
    externals: {
      codemirror: {
        root: "CodeMirror",
        commonjs: "codemirror",
        commonjs2: "codemirror",
        amd: "codemirror",
      },
      "codemirror/addon/search/search": {
        root: "CodeMirror",
        commonjs: "codemirror/addon/search/search",
        commonjs2: "codemirror/addon/search/search",
        amd: "codemirror/addon/search/search",
      },
      "codemirror/addon/search/searchcursor": {
        root: "CodeMirror",
        commonjs: "codemirror/addon/search/searchcursor",
        commonjs2: "codemirror/addon/search/searchcursor",
        amd: "codemirror/addon/search/searchcursor",
      },
    },
    optimization: {
      minimize: true,
    },
  };
}

/**
 * What a language module's bundle leaves to the editor's: the editor's own file
 * (`codemirror-blocks-min.js`, a global named `CodeMirrorBlocks`) has the editor,
 * React and the pretty-printer, and a language that is loaded after it uses
 * those, so that the page has one of each (and one registry of languages).
 */
const FROM_THE_EDITOR = {
  "@bootstrapworld/codemirror-blocks": {
    root: "CodeMirrorBlocks",
    commonjs: "@bootstrapworld/codemirror-blocks",
    commonjs2: "@bootstrapworld/codemirror-blocks",
    amd: "@bootstrapworld/codemirror-blocks",
  },
  react: {
    root: ["CodeMirrorBlocks", "React"],
    commonjs: "react",
    commonjs2: "react",
    amd: "react",
  },
  "pretty-fast-pretty-printer": {
    root: ["CodeMirrorBlocks", "Pretty"],
    commonjs: "pretty-fast-pretty-printer",
    commonjs2: "pretty-fast-pretty-printer",
    amd: "pretty-fast-pretty-printer",
  },
};

/**
 * Creates a webpack configuration for the bundle of a language module, a file
 * that is included with a `<script>` tag after the editor's (see
 * {@link getWebpackBundleConfig}): it adds the language to the editor on load,
 * and is the language (a global of the name `global`).
 *
 * @param config.name the name of the file: `wescheme` makes `wescheme-min.js`
 * @param config.global the name of the global that is the language: `CMBWeScheme`
 * @param config.entry the entry point of the module
 */
export function getLanguageBundleConfig(config: {
  name: string;
  global: string;
  entry: string;
}): WebpackConfiguration {
  const base = getWebpackBundleConfig({
    entry: { [config.name]: config.entry },
  });
  return {
    ...base,
    name: "language-bundle",
    output: {
      ...base.output,
      library: { name: config.global, type: "umd", export: "default" },
    },
    // (no report of the sizes: the language is a small part of a page)
    plugins: (base.plugins ?? []).filter(
      (p) => !p || p.constructor.name !== "BundleAnalyzerPlugin"
    ),
    externals: [base.externals as ExternalItem, FROM_THE_EDITOR],
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
  entry: WebpackConfiguration["entry"];
  context: WebpackConfiguration["context"];
}): WebpackConfiguration & {
  devServer?: WebpackDevServerConfiguration;
} {
  const siteDir = config.context;
  const baseConfig = getBaseConfig();
  return {
    ...baseConfig,
    name: "devServer",
    mode: "development",
    context: config.context,
    entry: config.entry,
    plugins: [
      ...(baseConfig.plugins ?? []),
      new HtmlWebpackPlugin({
        title: "CMB Dev Page",
      }),
    ],
    devtool: "cheap-module-source-map",
    optimization: {
      runtimeChunk: true,
    },
    devServer: {
      hot: true,
      host: "0.0.0.0",
      allowedHosts: "all",
      headers: { "Access-Control-Allow-Origin": "*" },
      static: {
        directory: path.resolve(__dirname, "static"),
        publicPath: siteDir,
        watch: true,
      },
    },
  };
}
