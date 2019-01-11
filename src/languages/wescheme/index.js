import WeschemeParser from './WeschemeParser';
import {addLanguage} from '../../languages/';
require('./style.less');

export default addLanguage(
  {
    id: 'wescheme',
    name: 'WeScheme',
    description: 'The WeScheme language',
    getParser() {
      return new WeschemeParser();
    },
    getRenderOptions() {
      return {
        lockNodesOfType: ['comment', 'functionDef', 'variableDef', 'struct']
      };
    },
  });
