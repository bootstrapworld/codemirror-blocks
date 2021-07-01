import "../../example/example-page.less";
import type { Language } from "../CodeMirrorBlocks";
import CodeMirrorBlocks from "../CodeMirrorBlocks";

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
  return CodeMirrorBlocks(container, {
    collapseAll: false, 
    value,
  }, language);
}