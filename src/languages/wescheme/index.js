import WeschemeParser from './WeschemeParser';
import CodeMirrorBlocks from '../../blocks';
import FunctionApp       from '../../components/FunctionApp';
import IfExpression     from '../../components/IfExpression';
import LambdaExpression from '../../components/LambdaExpression';
import CondExpression   from '../../components/CondExpression';
import CondClause       from '../../components/CondClause';
import Unknown          from '../../components/Unknown';
import Literal          from '../../components/Literal';
import Blank            from '../../components/Blank';
import Comment          from '../../components/Comment';
import IdentifierList   from '../../components/IdentifierList';
import StructDefinition from '../../components/StructDef';
import VariableDefinition from '../../components/VariableDef';
import FunctionDefinition from '../../components/FunctionDef';
import Sequence         from '../../components/Sequence';
require('./style.less');

export default CodeMirrorBlocks.languages.addLanguage(
  {
    id: 'wescheme',
    name: 'WeScheme',
    description: 'The WeScheme language',
    getParser() {
      return new WeschemeParser();
    },
    getRenderOptions() {
      return {
        extraRenderers: {
          unknown: Unknown,
          functionApp: FunctionApp,
          functionDefinition: FunctionDefinition,
          lambdaExpression: LambdaExpression,
          variableDefinition: VariableDefinition,
          identifierList : IdentifierList,
          ifExpression: IfExpression,
          condExpression: CondExpression,
          condClause: CondClause,
          structDefinition: StructDefinition,
          literal: Literal,
          comment: Comment,
          sequence: Sequence,
          blank: Blank,
        }
      };
    },
  });
