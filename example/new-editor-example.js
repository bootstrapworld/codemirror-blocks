import React from 'react';
import ReactDOM from 'react-dom';
import wescheme from '../src/languages/wescheme';
import ToggleEditor from '../src/ui/ToggleEditor';
import './example-page.less';


const exampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;

ReactDOM.render(<ToggleEditor language={wescheme} initialCode={exampleCode}/>,
                document.getElementById('cmb-editor'));
