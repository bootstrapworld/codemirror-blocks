import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';

import './lambda.less';
import {renderEditorInto} from '../../src/ui';
import '../../src/languages/lambda';

var editor = renderEditorInto(
  document.getElementById('editor'),
  'lambda'
);

window.editor = editor;
