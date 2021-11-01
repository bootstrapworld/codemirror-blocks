/**
 * This file is meant to be used on the wescheme.org website.
 * It is bundled using the webpack.
 */
import { WeScheme } from "./index";
import { CodeMirrorBlocks } from "codemirror-blocks";
import "codemirror/lib/codemirror.css";
import "./less/example.less";

export default function WeschemeBlocks(container, options) {
  return new CodeMirrorBlocks(container, options, WeScheme);
}
