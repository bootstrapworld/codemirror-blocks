import ExampleParser from './ExampleParser';
import {addLanguage} from '../../languages/';

require('./style.less');
export default addLanguage(
  {
    id: 'example',
    name: 'Example',
    description: 'An example language that illustrates how to add support for new languages',
    getParser() {
      return new ExampleParser();
    },
    getRenderOptions() {
      return {};
    },
  });
