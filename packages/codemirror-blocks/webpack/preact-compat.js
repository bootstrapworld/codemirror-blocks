// What `react` and `react-dom` are in the Preact builds (see umd-lite.config.js):
// preact/compat, with one difference in when effects run.
//
// React runs the effects of what a keypress rendered before the browser goes on
// to the next event. Preact runs them after the next paint, or 35 ms: a key
// pressed a few milliseconds later (typing at the top level opens an edit box,
// which takes focus in an effect) has been typed before the box has focus. Its
// hook for this, `options.requestAnimationFrame`, says when "after the paint" is:
// right after the render, in a microtask, which is before the next event.
import { options } from "preact";
import * as compat from "preact/compat";

options.requestAnimationFrame = (callback) => queueMicrotask(callback);

export * from "preact/compat";
export default compat.default ?? compat;
