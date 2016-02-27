import ExampleParser from './ExampleParser';
import CodeMirrorBlocks from '../../blocks';

export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'example',
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
