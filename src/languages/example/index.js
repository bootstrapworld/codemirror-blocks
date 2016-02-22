import ExampleParser from './ExampleParser';
import CodeMirrorBlocks from '../../blocks';

export default CodeMirrorBlocks.addLanguage(
  'example',
  {
    name: 'Example',
    description: 'An example language that illustrates how to add support for new languages',
    getParser() {
      return new ExampleParser();
    },
    getRenderers() {
      return {};
    },
    getCSS() {
      return null;
    }
  });
