import 'babel-polyfill'
import CodeMirror from 'CodeMirror'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/monokai.css'
import Parser from './parser.js'
import CodeMirrorBlocks from '../src/blocks.js'

require('./example.css')
require('./example-page.css')

var cm = CodeMirror.fromTextArea(
  document.getElementById("code"),
  {theme:'3024-day'}
)

var cm2 = CodeMirror.fromTextArea(
  document.getElementById('code2'),
  {theme:'3024-day'}
)

cm.setValue("(sum (+   (- 1 2)  3)\n (*  3  4)\n (/ 5 6))\n(product 5 6 7)")
//cm.setValue("(+ 1 2)")
cm2.swapDoc(cm.getDoc().linkedDoc({sharedHist: true}))

var blocks = new CodeMirrorBlocks(
  cm2,
  new Parser(),
  {
    willInsertNode(sourceNodeText, sourceNode, destination, destinationNode) {
      let line = cm2.getLine(destination.line)
      if (destination.ch > 0 && line[destination.ch - 1].match(/[\w\d]/)) {
        // previous character is a letter or number, so prefix a space
        sourceNodeText = ' ' + sourceNodeText
      }

      if (destination.ch < line.length && line[destination.ch].match(/[\w\d]/)) {
        // next character is a letter or a number, so append a space
        sourceNodeText += ' '
      }
      return sourceNodeText
    }
  })
blocks.setBlockMode(true)