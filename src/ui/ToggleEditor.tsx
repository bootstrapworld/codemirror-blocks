import React, {Component, createRef} from 'react';
import BlockEditor from './BlockEditor';
import TextEditor from './TextEditor';
import CMBContext from '../components/Context';
import Dialog from '../components/Dialog';
import ByString from './searchers/ByString';
import ByBlock from './searchers/ByBlock';
import attachSearch from './Search';
import Toolbar from './Toolbar';
import { ToggleButton, BugButton } from './EditorButtons';
import { say } from '../utils';
import TrashCan from './TrashCan';
import SHARED from '../shared';
import type { AST } from '../ast';
import type { Language, Options } from '../CodeMirrorBlocks';
import CodeMirror, { MarkerRange } from 'codemirror';

/**
 * Additional declarations of codemirror apis that are not in @types/codemirror... yet.
 * TODO(pcardune): open a pull request on this file to add these changes:
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/codemirror/index.d.ts
 */
declare module 'codemirror' {
  interface DocOrEditor {
    /**
     * Adds a new selection to the existing set of selections, and makes it the primary selection.
     */
    addSelection(anchor: Position, head?: Position): void;

    /**
     * An equivalent of extendSelection that acts on all selections at once.
     */
    extendSelections(heads: Position[]): void;

    /**
     * Applies the given function to all existing selections, and calls extendSelections on the result.
     */
    extendSelectionsBy(f: (range: Position) => Position): void;

    /**
     * Get the value of the 'extending' flag.
     */
    getExtending(): boolean;

    /**
     * Undo one edit or selection change.
     */
    undoSelection(): void;

    /**
     * Redo one undone edit or selection change.
     */
    redoSelection(): void;
  }

  interface Editor {
    /**
     * Allow the given string to be translated with the phrases option.
     */
    phrase(text: string): string;
  }
}

/**
 * Extensions to the codemirror API that are internal to CMB or
 * not documented in the codemirror docs.
 */
declare module 'codemirror' {
  interface TextMarker {
    /**
     * Specifies the type of text marker, either one made with markText,
     * or one made with setBookmark. Ones made with setBookmark have
     * type == "bookmark". This property is not documented in the codemirror
     * docs.
     */
    type: string;

    /**
     * Sepcified the options that were used when the marker was created.
     * This property is not documented in the codemirror docs but apparently
     * works.
     */
    options: CodeMirror.TextMarkerOptions;

    /**
     * Stores the ast node id associated with this text marker.
     */
    BLOCK_NODE_ID?: string;
  }
}

const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

const defaultCmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
  extraKeys: {"Shift-Tab": false},
};

// This is the complete list of methods exposed by the CodeMirror object
// SOME of them we override, but many can be exposed directly
// See buildAPI() in the ToggleEditor component
const codeMirrorAPI = ['getValue', 'setValue', 'getRange', 'replaceRange', 'getLine', 
  'lineCount', 'firstLine', 'lastLine', 'getLineHandle', 'getLineNumber', 'eachLine'
  , 'markClean', 'changeGeneration', 'isClean', 'getSelection', 'getSelections', 
  'replaceSelection', 'replaceSelections', 'getCursor', 'listSelections', 
  'somethingSelected', 'setCursor', 'setSelection', 'setSelections', 'addSelection', 
  'extendSelection', 'extendSelections', 'extendSelectionsBy', 'setExtending', 'getExtending', 
  'hasFocus', 'findPosH', 'findPosV', 'findWordAt', 'setOption', 'getOption', 'addKeyMap', 
  'removeKeyMap', 'addOverlay', 'removeOverlay', 'on', 'off', 'undo', 'redo', 'undoSelection', 
  'redoSelection', 'historySize', 'clearHistory', 'getHistory', 'setHistory', 'markText', 
  'setBookmark', 'findMarks', 'findMarksAt', 'getAllMarks', 'setGutterMarker', 
  'clearGutter', 'addLineClass', 'removeLineClass', 'lineInfo', 'addWidget', 'addLineWidget', 
  'setSize', 'scrollTo', 'getScrollInfo', 'scrollIntoView', 'cursorCoords', 'charCoords', 
  'coordsChar', 'lineAtHeight', 'heightAtLine', 'defaultTextHeight', 'defaultCharWidth', 
  'getViewport', 'refresh', 'operation', 'startOperation', 'endOperation', 'indentLine', 
  'toggleOverwrite', 'isReadOnly', 'lineSeparator', 'execCommand', 'posFromIndex', 
  'indexFromPos', 'focus', 'phrase', 'getInputField', 'getWrapperElement', 
  'getScrollerElement', 'getGutterElement'] as const;

type CodeMirrorAPI = Pick<CodeMirror.Editor, typeof codeMirrorAPI[number]>;

type ToggleEditorAPI = {
  getBlockMode(): boolean;
  setBlockMode(blockMode: boolean): void;
  getCM(): CodeMirror.Editor;
  on: CodeMirror.Editor['on'];
  off: CodeMirror.Editor['off'];
  runMode(): never;
  afterDOMUpdate(f: () => void): void;
};

export type API = ToggleEditorAPI & CodeMirrorAPI;

export type ToggleEditorProps = {
  initialCode?: string,
  cmOptions?: CodeMirror.EditorConfiguration,
  language: Language,
  options?: Options,
  api?: API,
  appElement: Element,
  debuggingLog?: {
    history?: unknown,
  },
}

type ToggleEditorState = {
  blockMode: boolean,
  code: string,
  // TODO(pcardune): dialog should probably not be a boolean.
  // I think we are using "false" in place of "null" unnecessarily.
  dialog: boolean | {title: string, content: string},
  debuggingLog?: ToggleEditorProps['debuggingLog'],
}

class ToggleEditor extends Component<ToggleEditorProps, ToggleEditorState> {
  state = {
    blockMode: false,
    dialog: false,
    code: "",
  }

  static defaultProps = {
    debuggingLog: {},
    cmOptions: {},
    code: String,
  }

  // TODO(pcardune): None of these should be here. Denormalizing
  // props is a very bad thing to do.
  cmOptions: CodeMirror.EditorConfiguration;
  options: Options;

  eventHandlers: Record<string, Function[]>;

  toolbarRef: React.RefObject<Toolbar>;
  ast?: AST;
  newAST?: AST;

  constructor(props: ToggleEditorProps) {
    super(props);

    this.toolbarRef = createRef();

    // construct announcer DOM node
    const announcements = document.createElement('div');
    announcements.setAttribute('aria-live', 'assertive');
    announcements.setAttribute('aria-atomic', 'true');
    SHARED.announcer = announcements;

    SHARED.recordedMarks = new Map();
    this.eventHandlers = {}; // blank event-handler record

    this.state.code = props.initialCode;
  }

  loadLoggedActions = (jsonLog) => {
    console.log('log is', jsonLog);
    this.setState({debuggingLog: jsonLog});
    this.props.api?.setValue(jsonLog.startingSource);
  }

  buildAPI(ed: CodeMirror.Editor): API {
    const base: any = {};
    // any CodeMirror function that we can call directly should be passed-through.
    // TextEditor and BlockEditor can add their own, or override them
    codeMirrorAPI.forEach(funcName => {
      base[funcName] = ed[funcName].bind(ed);
    });

    const api: ToggleEditorAPI = {
      // custom CMB methods
      'getBlockMode': () => this.state.blockMode,
      'setBlockMode': this.handleToggle,
      'getCM': () => ed,
      'on' : (...args: Parameters<CodeMirror.Editor['on']>) => {
        const [type, fn] = args;
        if(!this.eventHandlers[type]) { this.eventHandlers[type] = [fn]; }
        else { this.eventHandlers[type].push(fn); }
        SHARED.cm.on(type, fn);
      },
      'off' : (...args: Parameters<CodeMirror.Editor['on']>) => { 
        const [type, fn] = args;
        this.eventHandlers[type]?.filter(h => h !== fn);
        SHARED.cm.off(type, fn);
      },
      'runMode': () => { throw "runMode is not supported in CodeMirror-blocks"; },
      // Expose a scheduler for after react's render cycle is over
      // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
      'afterDOMUpdate' : (f) => {
        window.requestAnimationFrame(() => setTimeout(f, 0));
      }
    };
    return Object.assign(base, api);
  }

  // After a mode switch, rebuild the API and re-assign events
  handleEditorMounted = (ed: CodeMirror.Editor, api: API, ast: AST) => {
    // set CM aria attributes, and add announcer
    const mode = this.state.blockMode ? 'Block' : 'Text';
    const wrapper = ed.getWrapperElement();
    //Modal.setAppElement(this.props.appElement);
    ed.getScrollerElement().setAttribute('role', 'presentation');
    wrapper.setAttribute('aria-label', mode+' Editor');
    wrapper.appendChild(SHARED.announcer);
    // Rebuild the API and assign re-events
    Object.assign(this.props.api, this.buildAPI(ed), api);
    Object.keys(this.eventHandlers).forEach(type => {
      this.eventHandlers[type].forEach(h => ed.on(type as any, h));
    });
    
    // once the DOM has loaded, reconstitute any marks and render them
    // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
    window.requestAnimationFrame( () => setTimeout(() => {
      SHARED.recordedMarks.forEach((m: {options: CodeMirror.TextMarkerOptions}, k: number) => {
        let node = ast.getNodeByNId(k);
        if (node) {
          this.props.api?.markText(node.from, node.to, m.options);
        }
      });
    }, 0));
    // save the editor, and announce completed mode switch
    SHARED.cm = ed;
    say(mode + " Mode Enabled", 500);
  }

  // save any non-block, non-bookmark markers, and the NId they cover
  copyMarks(oldAST: AST) {
    SHARED.recordedMarks.clear();
    (SHARED.cm as CodeMirror.Editor).getAllMarks().filter(m => !m.BLOCK_NODE_ID && m.type !== "bookmark")
      .forEach((m: CodeMirror.TextMarker<MarkerRange>) => {
        if (m.type == "bookmark") {
          return;
        }
        const marker = m.find();
        if (!marker) {
          // marker is no longer in the document, bail
          return;
        }
        let {from: oldFrom, to: oldTo} = marker;
        const oldNode = oldAST.getNodeAt(oldFrom, oldTo); // find the node for the mark
        if(!oldNode) { // bail on non-node markers
          console.error(`Removed TextMarker at [{line:${oldFrom.line}, ch:${oldFrom.ch}},` +
          `{line:${oldTo.line}, ch:${oldTo.ch}}], since that range does not correspond to a node boundary`);
          return;
        }
        const newNode = this.newAST?.getNodeByNId(oldNode.nid); // use the NID to look node up srcLoc post-PP
        if (!newNode) {
          throw new Error("Could not find node "+oldNode.nid+" in new AST");
        }
        const {from, to} = newNode;
        SHARED.recordedMarks.set(
          oldNode.nid,
          {
            from: from,
            to: to,
            options: {
              css: m.css,
              title: m.title,
              className: m.className,
            }
          }
        );
      });
  }

  showDialog = (contents: {title: string, content: string}) =>
    this.setState( () =>({dialog: contents}));  
  closeDialog = () => this.setState( () =>({dialog: false}));

  handleToggle = (blockMode: boolean) => {
    this.setState( (state) => {
      let oldAst, WS, code;
      try {
        try {
          let oldCode = SHARED.cm.getValue();
          oldCode.match(/\s+$/);                       // match ending whitespace
          oldAst = SHARED.parse(oldCode);              // parse the code (WITH annotations)
        } catch (err) {
          console.error(err);
          try   { throw SHARED.getExceptionMessage(err); }
          catch(e){ throw "The parser failed, and the error could not be retrieved"; }
        }
        try {
          code = oldAst.toString() + (WS? WS[0] : "");  // pretty-print and restore whitespace
          this.ast = SHARED.parse(code);                // parse the pretty-printed (PP) code
        } catch (e) {
          console.error('COULD NOT PARSE PRETTY-PRINTED CODE FROM:\n', oldAst);
          console.error('PRETTY-PRINTED CODE WAS', oldAst.toString());
          throw `An error occured in the language module: 
          the pretty-printer probably produced invalid code.
          See the JS console for more detailed reporting.`;
        }
        this.copyMarks(oldAst);                         // Preserve old TextMarkers
        return {...state, blockMode: blockMode, code: code}; // Success! Set the state
      } catch (e) {                                     // Failure! Set the dialog state
        console.error(e);
        return {...state, dialog: { title: "Could not convert to Blocks", content: e.toString() }};
      }
    });
  }

  render() {
    const classes = 'Editor ' + (this.state.blockMode ? 'blocks' : 'text');
    return (
      <>
      <div className={classes}>
        {this.state.blockMode ? <BugButton/> : null}
        <ToggleButton 
          setBlockMode={this.handleToggle} 
          blockMode={this.state.blockMode} />
        {this.state.blockMode ? <TrashCan/> : null}
        <div className={"col-xs-3 toolbar-pane"} tabIndex={-1} aria-hidden={!this.state.blockMode}>
          <Toolbar 
            primitives={this.props.language.primitivesFn ? this.props.language.primitivesFn() : []}
            languageId={this.props.language.id}
            blockMode={this.state.blockMode} 
            ref={this.toolbarRef} />
        </div>
        <div className="col-xs-9 codemirror-pane">
        { this.state.blockMode? this.renderBlocks() : this.renderCode() }
        </div>
      </div>

      <div role="application" aria-roledescription="Stand by">
        <a id="SR_fix_for_slow_dom" href="#" aria-roledescription=":" aria-label=""></a>
      </div>

      <Dialog 
        appElement={this.props.appElement}
        isOpen={!!this.state.dialog}
        body={this.state.dialog}
        closeFn={this.closeDialog}/>
      </>
    );
  }

  renderCode() {
    return (
      <TextEditor
        cmOptions={{...defaultCmOptions, ...this.props.cmOptions}}
        parse={this.props.language.parse}
        value={this.state.code}
        onMount={this.handleEditorMounted}
        api={this.props.api} 
        passedAST={this.ast}
      />
    );
  }

  renderBlocks() {
    let defaultOptions = {
      parse: this.props.language.parse,
      incrementalRendering: true,
      collapseAll: true
    };
    return (
      <UpgradedBlockEditor
        cmOptions={{...defaultCmOptions, ...this.props.cmOptions}}
        parse={this.props.language.parse}
        value={this.state.code}
        onMount={this.handleEditorMounted}
        api={this.props.api}
        passedAST={this.ast}
        // the props below are unique to the BlockEditor
        appElement={this.props.appElement}
        languageId={this.props.language.id}
        options={{...defaultOptions, ...this.props.options}}
        showDialog={this.showDialog}
        closeDialog={this.closeDialog}
        toolbarRef={this.toolbarRef}
        debugHistory={this.props.debuggingLog?.history}
     />
    );
  }
}

export default CMBContext<ToggleEditorProps>(ToggleEditor);
