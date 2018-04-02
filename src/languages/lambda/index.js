import CodeMirrorBlocks from '../../blocks';
import parseString from './parser';

require('./style.less');
export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'lambda',
    name: 'Lambda',
    description: 'A simple language taken from lisperator.net',
    example: "1+1*2",
    getParser() {
      return {
        parse: parseString,
      };
    },
    getRenderOptions() {
      return {
        extraRenderers: {
          prog: require('./components/prog'),

        }
      };
    },
  });
