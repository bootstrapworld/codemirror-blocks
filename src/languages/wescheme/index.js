import WeschemeParser from './WeschemeParser';
import CodeMirrorBlocks from '../../blocks';

export default CodeMirrorBlocks.addLanguage(
  'wescheme',
  {
    name: 'WeScheme',
    description: 'The WeScheme language',
    parser() {
      return new WeschemeParser();
    },
    renderers() {
      return {};
    },
    css() {
      return null;
    }
  });
