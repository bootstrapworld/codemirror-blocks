/**
 * Modules ending with .mp3 are loaded by webpack's url-loader,
 * which generates a url string as the modules default export.
 */
declare module '*.mp3' {
  const content: string;
  export default content;
}