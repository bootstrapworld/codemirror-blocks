import wescheme from '../src/languages/wescheme';
import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import './example-page.less';
import bigExampleCode from './ast-test.rkt';
import hugeExampleCode from './huge-code.rkt';
const smallExampleCode = `
(comment free)
1; comment1
#| comment2 |#
2`;

//const exampleCode = smallExampleCode;
const exampleCode = bigExampleCode;
//const exampleCode = hugeExampleCode;

// grab the DOM Node to host the editor, and use it to instantiate
const container = document.getElementById('cmb-editor');
const editor = new CodeMirrorBlocks(container, {collapseAll: false, value: exampleCode}, wescheme);

// grab the load-from-log button
const loadLogButton  = document.getElementById('loadFromLog');
const downloadLogButton  = document.getElementById('downloadLog');
const nextButton     = document.getElementById('nextButton');

let history, lastAction, currentAction = 0;


downloadLogButton.onclick = () => {
   let json = {history: window.reducerActivities, exception: "DUMMY"};

   var element = document.createElement('a');
   element.setAttribute('href', 'data:text/plain;charset=utf-8,' 
      + encodeURIComponent(JSON.stringify(json)));
   element.setAttribute('download', "CMB Log.txt");

   element.style.display = 'none';
   document.body.appendChild(element);
   element.click();
   document.body.removeChild(element);
}

// When a file is loaded, read it
loadLogButton.onchange = (e) => { 
   	let file = e.target.files[0];
   	let reader = new FileReader();
   	reader.readAsText(file,'UTF-8');
   	// parse the string, draw the actions, and set up counters
      // and UI for replaying them
   	reader.onload = readEvent => {
         let log;
         try {
            log = JSON.parse(readEvent.target.result.toString());
            if(!(log.exception && log.history)) throw "Bad Log";
         } catch {
            console.log(readEvent.target.result.toString());
            alert("Malformed log file!\nContents printed to console");
            return;
         }
         editor.setValue('');
         editor.setBlockMode(true);
         editor.resetNodeCounter();
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
nextButton.onclick = (e) => {
   e.preventDefault();
   e.stopPropagation();
   let entries = [...document.getElementById("entries").children];
   entries.forEach(c => c.style.background = "none");
   entries[currentAction].style.background = "lightblue";
   editor.executeAction(history[currentAction]);
   currentAction++;
   if(currentAction == lastAction){ 
      nextButton.value = "Done";
      nextButton.disabled = true;
   }
   editor.focus();
}

// for debugging purposes
window.editor = editor
console.log(editor);
