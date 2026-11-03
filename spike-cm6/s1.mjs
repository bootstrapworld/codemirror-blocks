import {EditorState, Compartment, StateField, StateEffect, Annotation} from '@codemirror/state'
import {syntaxTree, ensureSyntaxTree} from '@codemirror/language'
import {history, undo, redo} from '@codemirror/commands'
import {lang} from './lang.mjs'
const hasErr=t=>{let e=false;t.iterate({enter:n=>{if(n.type.isError){e=true;return false}}});return e}
const out=(k,v)=>console.log(k.padEnd(48),v)

// (a) filter, using ensureSyntaxTree for completeness
const reject=EditorState.transactionFilter.of(tr=>{
  if(!tr.docChanged) return tr
  const t=ensureSyntaxTree(tr.state,tr.newDoc.length,5000)
  if(!t) return [] // parse didn't finish => reject conservatively
  return hasErr(t)?[]:tr
})
let s=EditorState.create({doc:'(a (b c) "s") ; hi\n(d)',extensions:[lang,reject,history()]})
const tryTr=(s,spec,l)=>{const n=s.update(spec).state;out(l,n.doc.eq(s.doc)?'REJECTED':'accepted: '+JSON.stringify(n.doc.toString().slice(0,40)));return n}
tryTr(s,{changes:{from:0,insert:'('}},'insert unmatched "("')
tryTr(s,{changes:{from:3,to:4}},'delete atom char (ok)')
tryTr(s,{changes:{from:0,to:1}},'delete "(" of list')
tryTr(s,{changes:{from:0,insert:'(x y) (z '}},'paste unbalanced')
tryTr(s,{changes:{from:0,insert:'(x y) (z)'}},'paste balanced')
tryTr(s,{changes:[{from:0,insert:'('},{from:5,insert:')'}]},'multi-range, balanced together')
tryTr(s,{changes:[{from:0,insert:'('},{from:5,insert:'x'}]},'multi-range, unbalanced')
tryTr(s,{changes:{from:7,insert:'"'}},'open string in list')
// error nodes in the initial/ non-filtered state
const bad=EditorState.create({doc:'(a',extensions:[lang]})
out('hasErr("(a")',hasErr(syntaxTree(bad)))
// the filter can't protect the initial doc: first edit on a broken doc
const bad2=EditorState.create({doc:'(a',extensions:[lang,reject]})
tryTr(bad2,{changes:{from:2,insert:')'}},'fixing a broken doc (rejected = problem)')

// incremental completeness at filter time on big doc
const big=Array.from({length:5000},(_, i)=>`(define (f${i} x) (+ x ${i} (g "s${i}" y)))`).join('\n')
let t0=performance.now()
let b=EditorState.create({doc:big,extensions:[lang]})
let tr=ensureSyntaxTree(b,b.doc.length,60000); out('initial full parse ms',(performance.now()-t0).toFixed(0)+' lines=5000 chars='+big.length+' complete='+!!tr)
// without forcing: what does syntaxTree give right after an edit?
const noForce=b.update({changes:{from:10,insert:'z'}}).state
out('syntaxTree() after edit, tree length vs doc',syntaxTree(noForce).length+' / '+noForce.doc.length)
// per-edit timing
const edits=[]; let cur=b
for(let i=0;i<50;i++){const pos=Math.floor(Math.random()*cur.doc.length*0.9)
  const t=performance.now(); const ns=cur.update({changes:{from:pos,insert:'zz'}}).state
  const tt=ensureSyntaxTree(ns,ns.doc.length,60000); edits.push(performance.now()-t); cur=ns}
edits.sort((a,b)=>a-b); out('per-edit incremental parse ms p50/p95/max',[edits[25],edits[47],edits[49]].map(x=>x.toFixed(2)).join(' / '))
// per-edit with filter + hasErr scan (whole-tree scan) cost
const f=EditorState.create({doc:big,extensions:[lang,reject]}); 
ensureSyntaxTree(f,f.doc.length,60000)
const e2=[];let c2=f
for(let i=0;i<30;i++){const pos=Math.floor(Math.random()*c2.doc.length*0.9);const t=performance.now();c2=c2.update({changes:{from:pos,insert:'zz'}}).state;e2.push(performance.now()-t)}
e2.sort((a,b)=>a-b); out('per-edit WITH filter+full error scan ms p50/max',e2[15].toFixed(2)+' / '+e2[29].toFixed(2))
out('edits accepted (doc grew)',c2.doc.length-f.doc.length)
// (b)/(c) history across compartment reconfig + mark + tagging
const blockMode=new Compartment(), marks=StateField.define({create:()=>[],update:(v,tr)=>v.map(r=>({from:tr.changes.mapPos(r.from,1),to:tr.changes.mapPos(r.to,-1)})),})
const setMark=StateEffect.define()
const mf=StateField.define({create:()=>null,update:(v,tr)=>{if(v)v={from:tr.changes.mapPos(v.from,1),to:tr.changes.mapPos(v.to,-1)};for(const e of tr.effects)if(e.is(setMark))v=e.value;return v}})
const blockExt=EditorState.transactionFilter.of(tr=>tr.docChanged&&hasErr(ensureSyntaxTree(tr.state,tr.newDoc.length,5000))?[]:tr)
const parsesAnn=Annotation.define()
let h=EditorState.create({doc:'(a b) (c d)',extensions:[lang,history(),mf,blockMode.of([])]})
h=h.update({effects:setMark.of({from:6,to:11})}).state
h=h.update({changes:{from:0,insert:'X'},selection:{anchor:3}}).state
h=h.update({changes:{from:1,insert:'Y'}}).state
h=h.update({effects:blockMode.reconfigure(blockExt)}).state   // enter block mode
out('after switch: doc, sel, mark',[h.doc.toString(),h.selection.main.anchor,JSON.stringify(h.field(mf))].join(' | '))
let u;undo({state:h,dispatch:t=>u=t.state}); out('undo in block mode (history survived)',u.doc.toString())
h=h.update({effects:blockMode.reconfigure([])}).state       // back to text mode
undo({state:h,dispatch:t=>u=t.state});out('undo after switch back',u.doc.toString()+' mark='+JSON.stringify(u.field(mf)))
// (c) tag each transaction with parses/broken; custom undo skipping broken
const tag=EditorState.transactionExtender.of(tr=>tr.docChanged?{annotations:parsesAnn.of(!hasErr(ensureSyntaxTree(tr.state,tr.newDoc.length,5000)))}:null)
let t1=EditorState.create({doc:'(a)',extensions:[lang,history({minDepth:100,newGroupDelay:0}),tag]})
const log=[]
const step=(from,ins)=>{const tr=t1.update({changes:{from,insert:ins},userEvent:'input'});t1=tr.state;log.push([ins,tr.annotation(parsesAnn)])}
step(1,' (b');step(4,' c');step(6,')')   // "(a (b c)" -> broken, broken, then (a (b c)) ok
out('tags',JSON.stringify(log)+' doc='+t1.doc.toString())
out('annotation on history event?','history() stores inverted changes only; annotations are not kept on the event, so we keep our own parallel stack: StateField of [{docVersion, parses}]')
// custom undo: undo repeatedly until state parses
const ud=s=>{let cur=s,ok=false;for(let i=0;i<10&&!ok;i++){let nx=null;undo({state:cur,dispatch:t=>nx=t.state});if(!nx||nx===cur)break;cur=nx;ok=!hasErr(ensureSyntaxTree(cur,cur.doc.length,5000))}return cur}
out('undo-until-parses from ok state',JSON.stringify(ud(t1).doc.toString()))
process.exit()
