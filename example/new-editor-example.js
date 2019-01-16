import React from 'react';
import ReactDOM from 'react-dom';
import wescheme from '../src/languages/wescheme';
import ToggleEditor from '../src/ui/ToggleEditor';
import './example-page.less';
import bigExampleCode from './ast-test.rkt';


const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;

const useBigCode = true;
const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;

ReactDOM.render(<ToggleEditor language={wescheme} initialCode={exampleCode}/>,
                document.getElementById('cmb-editor'));
