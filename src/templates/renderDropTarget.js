import render from '../render';
module.exports = function(line, ch) {
  var template = require('./drop-target.handlebars');
  template({node: node, cm: this.cm, callback: this.callback});
  if (!node) {
    return '';
  }
  var nodeEl = render(node, this.cm, this.callback);
  var temp = document.createElement('div');
  temp.appendChild(nodeEl);
  return temp.innerHTML;
}
