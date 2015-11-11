import CodeMirror from 'CodeMirror'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/monokai.css'

import Parser from './parser.js'
import CodeMirrorBlocks from '../src/blocks.js'

var cm = CodeMirror.fromTextArea(
  document.getElementById("code"),
  {theme:'monokai'}
)

cm.setValue("(sum (+   (- 1 2)  3)\n (*  3  4)\n (/ 5 6))")


var blocks = new CodeMirrorBlocks(cm, new Parser())
blocks.setBlockMode(true)

document.getElementById("blocks").onclick = function() {
  blocks.toggleBlockMode()
}
