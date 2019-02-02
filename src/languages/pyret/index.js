import PyretParser from './PyretParser';
import {addLanguage} from '../../languages/';
require('./style.less');

export default addLanguage(
  {
    id: 'pyret',
    name: 'Pyret',
    description: 'The Pyret language',
    getParser() {
      return new PyretParser();
    },
    getRenderOptions() {
      return {
        // TODO: perhaps also ['functionDefinition', 'variableDefinition', 'structDefinition']?
        lockNodesOfType: ['comment']
      };
    },
  });
