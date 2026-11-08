import React from "react";
import * as Pretty from "pretty-fast-pretty-printer";
import CodeMirrorBlocks from "./CodeMirrorBlocks";
import * as api from "./CodeMirrorBlocks";

/*
 * The entry point of `dist/codemirror-blocks-min.js`, the editor for a page that
 * loads it with a `<script>` tag. The global `CodeMirrorBlocks` is the function
 * that makes an editor, with the rest of the API on it (`CodeMirrorBlocks.defineNode`,
 * `CodeMirrorBlocks.Languages`, ...): a language module's file, loaded after this
 * one, finds what it needs there, and adds its language. It also has the copies of
 * React and of the pretty-printer that the editor is made of, so that the languages
 * use them, and the page has one of each.
 */
export default Object.assign(CodeMirrorBlocks, api, { React, Pretty });
