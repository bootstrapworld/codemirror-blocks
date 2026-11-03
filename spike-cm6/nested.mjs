import {EditorState, StateField} from '@codemirror/state'
import {EditorView, Decoration, WidgetType} from '@codemirror/view'
import {syntaxTree} from '@codemirror/language'
import {lang} from './lang.mjs'
const mk=(n,src,level,base)=>{ // nested treeitems built from the syntax tree
  const el=document.createElement('span'); el.className='blk'; el.tabIndex=-1; el.setAttribute('role','treeitem'); el.setAttribute('aria-level',level)
  el.setAttribute('aria-expanded','true'); el.dataset.from=base+n.from
  const kids=[];for(let c=n.node.firstChild;c;c=c.nextSibling) if(c.name==='List') kids.push(c)
  el.setAttribute('aria-label',(kids.length?'list of ':'list ')+src.slice(n.from,n.to).slice(0,20))
  if(kids.length){const g=document.createElement('span');g.setAttribute('role','group');el.append('(');kids.forEach(k=>g.append(mk(k,src,level+1,base)));el.append(g,')')}
  else el.append(src.slice(n.from,n.to)); return el}
class W extends WidgetType{constructor(src,from){super();this.src=src;this.from=from}
  eq(o){return o.src===this.src&&o.from===this.from}
  updateDOM(){return false}
  toDOM(){const t=lang.parser.parse(this.src);const root=mk(t.topNode.firstChild,this.src,1,this.from);root.contentEditable='false';
    root.addEventListener('focusin',e=>e.stopPropagation()); return root}
  ignoreEvent(){return true}}
const f=StateField.define({create:s=>b(s),update:(v,tr)=>tr.docChanged?b(tr.state):v,provide:f=>[EditorView.decorations.from(f),EditorView.atomicRanges.of(v=>v.state.field(f))]})
const b=s=>{const r=[];syntaxTree(s).iterate({enter:n=>{if(n.name==='List'){r.push(Decoration.replace({widget:new W(s.sliceDoc(n.from,n.to),n.from)}).range(n.from,n.to));return false}}});return Decoration.set(r)}
window.view=new EditorView({parent:document.getElementById('r'),state:EditorState.create({doc:'(a (b (c d)) e)\n(x (y))\n',extensions:[lang,f,EditorView.contentAttributes.of({role:'tree','aria-label':'program'})]})})
