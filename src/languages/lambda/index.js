import {addLanguage} from '../../languages/';
import parseString from './parser';

require('./style.less');
export default addLanguage(
  {
    id: 'lambda',
    name: 'Lambda',
    description: 'A simple language taken from lisperator.net',
    example: "1+1*2",
    parse: parseString,
  });
