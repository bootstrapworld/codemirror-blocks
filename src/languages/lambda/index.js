import CodeMirrorBlocks from '../../blocks';
import parseString from './parser';

export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'lambda',
    name: 'Lambda',
    description: 'A simple language taken from lisperator.net',
    getParser() {
      return {
        parse: parseString,
      };
    },
    getRenderOptions() {
      return {
        extraRenderers: {
          prog: require('./templates/prog.handlebars')
        }
      };
    },
  });
