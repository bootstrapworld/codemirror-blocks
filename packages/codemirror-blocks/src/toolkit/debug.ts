import "codemirror/lib/codemirror.css";
import "./debug-page.less";
import type { Language } from "../CodeMirrorBlocks";
import CodeMirrorBlocks from "../CodeMirrorBlocks";
import { resetUniqueIdGenerator } from "../utils";
import { getReducerActivities } from "../state/reducers";

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

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const container = document.getElementById("cmb-editor")!;
  // grab the load-from-log button
  const loadLogButton = document.getElementById(
    "loadFromLog"
  ) as HTMLInputElement;
  const downloadLogButton = document.getElementById(
    "downloadLog"
  ) as HTMLButtonElement;
  const nextButton = document.getElementById("nextButton") as HTMLButtonElement;

  const editor = CodeMirrorBlocks(
    container,
    {
      collapseAll: false,
      value,
    },
    language
  );

  type JSONLog = {
    history: ReturnType<typeof getReducerActivities>;
    exception: string;
  };

  let history: JSONLog["history"];
  let lastAction: number;
  let currentAction = 0;

  downloadLogButton.onclick = () => {
    const json: JSONLog = {
      history: getReducerActivities(),
      exception: "DUMMY",
    };

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," +
        encodeURIComponent(JSON.stringify(json))
    );
    element.setAttribute("download", "CMB Log.txt");

    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // When a file is loaded, read it
  loadLogButton.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) {
      throw new Error("loadLogButton should be a file input");
    }
    const file = files[0];
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    // parse the string, draw the actions, and set up counters
    // and UI for replaying them
    reader.onload = (readEvent) => {
      let log: JSONLog;
      const result = readEvent.target?.result;
      if (!result) {
        throw new Error("no result");
      }
      try {
        log = JSON.parse(result.toString());
        if (!(log.exception && log.history)) {
          throw "Bad Log";
        }
      } catch {
        console.error(result.toString());
        alert("Malformed log file!\nContents printed to console");
        return;
      }
      editor.setValue("");
      editor.setBlockMode(true);
      resetUniqueIdGenerator();
      history = log.history;
      history.forEach((entry) => {
        const LI = document.createElement("LI");
        LI.className = "logEntry";
        LI.innerHTML = JSON.stringify(entry);
        document.getElementById("entries")?.appendChild(LI);
      });
      lastAction = history.length;
      nextButton.style.display = "inline-block";
      loadLogButton.style.display = "none";
    };
  };

  // Highlight the active entry and pass it to the editor
  // Once we've gone through all of them, change the UI
  nextButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const entries = [
      ...(document.getElementById("entries")?.children ?? []),
    ] as HTMLElement[];
    entries.forEach((c) => (c.style.background = "none"));
    entries[currentAction].style.background = "lightblue";
    editor.executeAction(history[currentAction]);
    currentAction++;
    if (currentAction == lastAction) {
      nextButton.value = "Done";
      nextButton.disabled = true;
    }
    editor.focus();
  };

  return editor;
}
