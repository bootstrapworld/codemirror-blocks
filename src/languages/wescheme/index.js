import WeschemeParser from './WeschemeParser';
import CodeMirrorBlocks from '../../blocks';

export default CodeMirrorBlocks.addLanguage(
  'wescheme',
  {
    name: 'WeScheme',
    description: 'The WeScheme language',
    getParser() {
      return new WeschemeParser();
    },
    getRenderers() {
      return {};
    },
    getCSS() {
      return null;
    }
  });
