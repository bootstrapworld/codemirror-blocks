import WeschemeParser from './WeschemeParser';
import CodeMirrorBlocks from '../../blocks';

require('./style.less');
export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'wescheme',
    name: 'WeScheme',
    description: 'The WeScheme language',
    getParser() {
      return new WeschemeParser();
    },
    getRendererOptions() {
      return {};
    }
  });
