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
 * @module codemirror-blocks/toolkit
 */
export { getWebpackBundleConfig, getWebpackDevServerConfig } from "./webpack";
