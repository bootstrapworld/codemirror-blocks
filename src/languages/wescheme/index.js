import WeschemeParser from './WeschemeParser';
import CodeMirrorBlocks from '../../blocks';
import LetLikeExpr from './components/LetLikeExpr'

require('./style.less');

export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'wescheme',
    name: 'WeScheme',
    description: 'The WeScheme language',
    getParser() {
      return new WeschemeParser();
    },
    getRenderOptions() {
      return {
        extraRenderers: {
          letLikeExpr: LetLikeExpr,
        }
      };
    },
  });
