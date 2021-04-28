import ExampleParser from './ExampleParser';
import {addLanguage} from '../../languages/';

let parser = new ExampleParser();

require('./style.less');
export default addLanguage(
  {
    id: 'example',
    name: 'Example',
    description: 'An example language that illustrates how to add support for new languages',
    parse: parser.parse,
    getExceptionMessage: parser.getExceptionMessage,
    /*
    getParser() {
      return new ExampleParser();
    },
    */
  });
