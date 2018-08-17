import PyretParser from './PyretParser.js';
import CodeMirrorBlocks from '../../blocks';

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
      return {};
    },
  });
