import render from './render'

export default class CodeMirrorBlocks {
  constructor(cm, parser) {
    this.cm = cm
    this.parser = parser
    this.blockMode = false
  }

  setBlockMode(mode) {
    if (mode === this.blockMode) {
      return
    }
    this.blockMode = mode
    if (this.blockMode) {
      var ast = this.parser.parse(this.cm.getValue())
      render(ast, this.cm)
    } else {
      this.cm.getAllMarks().forEach(marker => marker.clear())
      console.log('do something')
    }
  }

  toggleBlockMode() {
    this.setBlockMode(!this.blockMode)
  }
}