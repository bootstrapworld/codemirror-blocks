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
const loadLogButton  = document.getElementById('loadFromLog');
const nextButton     = document.getElementById('nextButton');

let history, lastAction, currentAction = 0;

loadLogButton.onclick = (e) => {
   if(!editor.getBlockMode()){
      alert('Block Mode must be enabled to read a log from the block editor');
      e.preventDefault();
   }
}

// When a file is loaded, read it
loadLogButton.onchange = (e) => { 
   	let file = e.target.files[0];
   	let reader = new FileReader();
   	reader.readAsText(file,'UTF-8');
   	// parse the string, draw the actions, and set up counters
      // and UI for replaying them
   	reader.onload = readEvent => {
   		let log = JSON.parse(readEvent.target.result.toString());
         history = log.history;
   		history.forEach(entry => {
            let LI = document.createElement("LI");
            LI.className = "logEntry";
            LI.innerHTML = JSON.stringify(entry);
            document.getElementById("entries").appendChild(LI);
         });
         lastAction = history.length;
         nextButton.style.display = "inline-block";
         loadLogButton.style.display = "none";
   	}
}

// Highlight the active entry and pass it to the editor
// Once we've gone through all of them, change the UI
nextButton.onclick = () => {
   let entries = [...document.getElementById("entries").children];
   entries.forEach(c => c.style.background = "none");
   entries[currentAction].style.background = "lightblue";
   editor.executeAction(history[currentAction]);
   currentAction++;
   if(currentAction == lastAction){ 
      nextButton.value = "Done";
      nextButton.onclick = null;
      nextButton.disabled = true;
   }
   editor.focus();
}

// for debugging purposes
window.editor = editor
console.log(editor);
