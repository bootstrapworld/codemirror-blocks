export async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function removeEventListeners() {
  const oldElem = document.body;
  const newElem = oldElem.cloneNode(true);
  oldElem.parentNode.replaceChild(newElem, oldElem);
}

export function cleanupAfterTest(rootId, store) {
  document.body.removeChild(document.getElementById('root'));
  store.dispatch({type: "RESET_STORE_FOR_TESTING"});
  const textareas = document.getElementsByTagName("textarea");
  while (textareas[0]) {
    const current = textareas[0];
    current.parentNode.removeChild(current);
  }
}
