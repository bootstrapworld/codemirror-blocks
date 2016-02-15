import 'babel-polyfill';
import CodeMirrorBlocks from './blocks';
CodeMirrorBlocks.ast = require('./ast');
CodeMirrorBlocks.parsers = {
  WeschemeParser: require('./parsers/wescheme')
};
CodeMirrorBlocks.CodeMirror = require('codemirror');
module.exports = CodeMirrorBlocks;
