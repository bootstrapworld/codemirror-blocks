import 'babel-polyfill';
import CodeMirrorBlocks from './blocks';
import WeschemeParser from './languages/wescheme/WeschemeParser.js';
CodeMirrorBlocks.ast = require('./ast');
CodeMirrorBlocks.parsers = {
  wescheme: (...args) => new WeschemeParser(...args)
};
CodeMirrorBlocks.CodeMirror = require('codemirror');
module.exports = CodeMirrorBlocks;
