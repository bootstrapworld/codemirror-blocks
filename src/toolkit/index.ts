/**
 * codemirror-blocks/toolkit contains helper functions and modules for testing
 * and building language modules.
 * 
 * **Webpack Configuration**
 * 
 * These helper functions provide sensible default configuration objects for webpack:
 * 
 * - {@link getWebpackDevServerConfig} for running a simple development server
 *   to try out your code in a browser
 * - {@link getWebpackBundleConfig} for generating a minified javascript bundle that
 *   can be included with a `<script>` tag.
 * 
 * **Karma Configuration**
 * 
 * These helper functions are for setting up the karma test runner:
 * 
 * - {@link getKarmaConfig}
 * 
 * @example
 * ```js
 * import path from 'path';
 * import {getWebpackDevServerConfig, getWebpackBundleConfig} from 'codemirror-blocks/toolkit';
 * module.exports = [
 *   getWebpackDevServerConfig({
 *     context: path.resolve('site'),
 *     entry: "./index.ts"
 *   }),
 *   getWebpackBundleConfig({
 *     entry: {
 *       "CodeMirrorBlocks": path.resolve(__dirname, "src", "index"),
 *     }
 *   })
 * ];
 * ```
 * @module codemirror-blocks/toolkit
 */
export {getWebpackBundleConfig, getWebpackDevServerConfig} from './webpack';
export {getKarmaConfig} from './karma';