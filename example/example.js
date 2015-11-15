import 'babel-polyfill'
import CodeMirror from 'CodeMirror'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/monokai.css'
import Parser from './parser.js'
import CodeMirrorBlocks from '../src/blocks.js'

require('./example.css')

var cm = CodeMirror.fromTextArea(
  document.getElementById("code"),
  {theme:'3024-day'}
)

cm.setValue("(sum (+   (- 1 2)  3)\n (*  3  4)\n (/ 5 6))")
//cm.setValue("(+ 1 2)")

var blocks = new CodeMirrorBlocks(cm, new Parser())
blocks.setBlockMode(true)

document.getElementById("blocks").onclick = function() {
  blocks.toggleBlockMode()
  this.innerText = `Turn block mode ${blocks.blockMode ? "off" : "on"}`
}
