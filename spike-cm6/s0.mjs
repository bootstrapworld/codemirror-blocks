import {JSDOM} from 'jsdom'
const d=new JSDOM('<div id=r></div>',{pretendToBeVisual:true})
for (const k of ['window','document','navigator','MutationObserver','getComputedStyle','Node','Element','HTMLElement','requestAnimationFrame','DOMParser','Range','Selection'])
  Object.defineProperty(globalThis,k,{value:d.window[k],configurable:true,writable:true})
if(!globalThis.document.createRange) 0
const {EditorView}=await import('@codemirror/view')
const {EditorState}=await import('@codemirror/state')
try{
const v=new EditorView({state:EditorState.create({doc:'(a b)'}),parent:d.window.document.getElementById('r')})
v.dispatch({changes:{from:0,insert:'x'}})
console.log('OK',v.state.doc.toString(),d.window.document.querySelector('.cm-content').textContent)
}catch(e){console.log('FAIL',e.message)}
process.exit()
