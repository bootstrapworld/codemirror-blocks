import wescheme from '../src/languages/wescheme';
import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import './example-page.less';
import bigExampleCode from './ast-test.rkt';


const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;

const useBigCode = true;
const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;

// grab the DOM Node to host the editor, and use it to instantiate
const container = document.getElementById('cmb-editor');
const editor = new CodeMirrorBlocks(container, {collapseAll: false, value: exampleCode}, wescheme);

// grab the load-from-log button
const loadLogButton = document.getElementById('loadFromLog');
loadLogButton.onchange = (e) => { 
   	var file = e.target.files[0];
   	var reader = new FileReader();
   	reader.readAsText(file,'UTF-8');
   	// parse the string and send the JSON object to the editor
   	reader.onload = readerEvent => {
      	editor.loadLoggedActions(JSON.parse(readerEvent.target.result.toString()));
   	}
}

// for debugging purposes
window.editor = editor
console.log(editor);
