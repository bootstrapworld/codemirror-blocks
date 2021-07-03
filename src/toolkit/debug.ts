import "codemirror/lib/codemirror.css";
import '../../example/example-page.less';
import type { Language } from '../CodeMirrorBlocks';
import CodeMirrorBlocks from '../CodeMirrorBlocks';

/**
 * Renders the codemirror blocks editor to the page along with some
 * debugging tools for downloading and replaying reducer action logs
 * 
 * @param language the language definition to use when instantiating the editor
 * @param value Initial string of code to load the codemirror blocks editor with
 * @returns the codemirror blocks editor
 */
export function createDebuggingInterface(language: Language, value: string) {
  document.body.innerHTML = `
  <div class="container editor-example">
  <div class="page-header">
    <h1>codemirror-blocks <small>${language.name}</small></h1>
  </div>
  <div class="row">
    <div class="col-md-12">
      <div id="cmb-editor" class="editor-container"/>
      </div>
    </div>
  </div>
  <input type="file" value="Load Logging Data" id="loadFromLog"/>
  <input type="button" value=">>" id="nextButton"/>
  <input type="button" value="Download Log" id="downloadLog"/>
  <div id="debuggingLog">
    <ol id="entries">
    </ol>
  </div>
</div>
  `;

  const container = document.getElementById('cmb-editor');
  // grab the load-from-log button
  const loadLogButton = document.getElementById(
    'loadFromLog'
  ) as HTMLInputElement;
  const downloadLogButton = document.getElementById(
    'downloadLog'
  ) as HTMLButtonElement;
  const nextButton = document.getElementById('nextButton') as HTMLButtonElement;

  const editor = CodeMirrorBlocks(
    container,
    {
      collapseAll: false,
      value,
    },
    language
  );

  let history,
    lastAction,
    currentAction = 0;

  downloadLogButton.onclick = () => {
    let json = { history: window.reducerActivities, exception: 'DUMMY' };

    var element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(json))
    );
    element.setAttribute('download', 'CMB Log.txt');

    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // When a file is loaded, read it
  loadLogButton.onchange = (e) => {
    let file = (e.target as HTMLInputElement).files[0];
    let reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    // parse the string, draw the actions, and set up counters
    // and UI for replaying them
    reader.onload = (readEvent) => {
      let log;
      try {
        log = JSON.parse(readEvent.target.result.toString());
        if (!(log.exception && log.history)) throw 'Bad Log';
      } catch {
        console.log(readEvent.target.result.toString());
        alert('Malformed log file!\nContents printed to console');
        return;
      }
      editor.setValue('');
      editor.setBlockMode(true);
      editor.resetNodeCounter();
      history = log.history;
      history.forEach((entry) => {
        let LI = document.createElement('LI');
        LI.className = 'logEntry';
        LI.innerHTML = JSON.stringify(entry);
        document.getElementById('entries').appendChild(LI);
      });
      lastAction = history.length;
      nextButton.style.display = 'inline-block';
      loadLogButton.style.display = 'none';
    };
  };

  // Highlight the active entry and pass it to the editor
  // Once we've gone through all of them, change the UI
  nextButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let entries = [...document.getElementById('entries').children] as HTMLElement[];
    entries.forEach((c) => (c.style.background = 'none'));
    entries[currentAction].style.background = 'lightblue';
    editor.executeAction(history[currentAction]);
    currentAction++;
    if (currentAction == lastAction) {
      nextButton.value = 'Done';
      nextButton.disabled = true;
    }
    editor.focus();
  };

  return editor;
}
