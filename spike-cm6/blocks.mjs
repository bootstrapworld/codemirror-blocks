import {EditorState, RangeSetBuilder, StateField} from '@codemirror/state'
import {EditorView, Decoration, WidgetType, keymap} from '@codemirror/view'
import {syntaxTree} from '@codemirror/language'
import {history, historyKeymap, defaultKeymap} from '@codemirror/commands'
import {lang} from './lang.mjs'

class BlockWidget extends WidgetType {
  constructor(text, level, from, to, kids){super();Object.assign(this,{text,level,from,to,kids})}
  eq(o){return o.text===this.text&&o.level===this.level&&o.from===this.from}
  toDOM(view){
    const el=document.createElement('span')
    el.className='blk'; el.setAttribute('role','treeitem'); el.tabIndex=-1
    el.setAttribute('aria-level',this.level); el.setAttribute('aria-expanded','true')
    el.setAttribute('aria-label','list '+this.text.slice(0,30)); el.dataset.from=this.from
    el.contentEditable='false'
    el.textContent=this.text
    el.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'){const all=[...view.dom.querySelectorAll('.blk')];const n=all[all.indexOf(el)+1];n&&n.focus();e.preventDefault()}
      if(e.key==='ArrowLeft'){const all=[...view.dom.querySelectorAll('.blk')];const n=all[all.indexOf(el)-1];n&&n.focus();e.preventDefault()}
      if(e.key==='Delete'){view.dispatch({changes:{from:+el.dataset.from,to:+el.dataset.from+this.text.length}});e.preventDefault()}
    })
    return el
  }
  updateDOM(el){ // reuse the element (keeps DOM focus) when the same kind of widget is re-rendered
    el.dataset.from=this.from; el.setAttribute('aria-label','list '+this.text.slice(0,30)); el.textContent=this.text; return true }
  ignoreEvent(){return true}   // widget handles its own events
}
// top-level lists -> one widget each (nested rendered as text inside; a real port would use nested widgets or React portals)
function build(state){
  const b=[];syntaxTree(state).iterate({enter:n=>{ if(n.name==='List'){b.push(Decoration.replace({widget:new BlockWidget(state.sliceDoc(n.from,n.to),1,n.from,n.to),block:false}).range(n.from,n.to));return false}}})
  return Decoration.set(b)
}
const blocks=StateField.define({create:build,update:(v,tr)=>tr.docChanged?build(tr.state):v,
  provide:f=>[EditorView.decorations.from(f),EditorView.atomicRanges.of(v=>v.state.field(f))]})
export function make(parent,doc){
  const view=new EditorView({parent,state:EditorState.create({doc,extensions:[lang,history(),blocks,keymap.of([...historyKeymap,...defaultKeymap]),
    EditorView.contentAttributes.of({role:'tree','aria-label':'program'})]})})
  window.view=view; return view
}
