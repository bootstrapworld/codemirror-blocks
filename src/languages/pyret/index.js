import PyretParser from './PyretParser.js';
import CodeMirrorBlocks from '../../blocks';
import Func from './components/Func';
import ABlank from './components/ABlank';
import Bind from './components/Bind';
import Binop from './components/Binop';

require('./style.less');

export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'pyret',
    name: 'Pyret',
    description: 'The Pyret language (pyret.org)',
    getParser() {
      return new PyretParser();
    },
    getRenderOptions() {
      return {
        extraRenderers: {
          'func': Func,
          'ablank': ABlank,
          'bind': Bind,
          'binop': Binop
        }
      };
    },
  });
