import {renderHTMLString} from '../render';
import {ASTNode} from '../ast';
module.exports = function(node) {
  if (!node) {
    return '';
  }
  return renderHTMLString(node);
};
