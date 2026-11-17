/*
 * Thirteenth round: what old tests import from the existing editor's INTERNALS (the redux store, the node classes, the summary module,
 * the CodeMirror-api module, the entry point). Nothing is built behind these names: each one throws "not in the compat layer" when it is USED,
 * so that a ported file loads and its tests fail with the reason (the measurement classifies them "cannot run: <name>").
 */
const missing = (name: string, why: string) => {
  const f = (..._a: unknown[]): never => {
    throw new Error(`not in the compat layer: ${name} (${why})`);
  };
  return f;
};
const STORE = "the redux store of the old editor";
export const createAppStore = missing("createAppStore", STORE);
export type AppStore = unknown;
export const Literal = missing("Literal", "the old node classes");
export const Unknown = missing("Unknown", "the old node classes");
export const FunctionAppNode = missing("FunctionAppNode", "the old node classes");
export const describeKinds = missing("describeKinds", "the summary module: the summary read on first opening is not built");
export const summarizeProgram = missing("summarizeProgram", "the summary module: the summary read on first opening is not built");
export const blockModeOnlyMethods: string[] = [];
export const buildAPI = missing("buildAPI", "the CM5 API object of the old editor");
export const resetActivityLog = () => undefined;
export const Languages: Record<string, unknown> = {};
const CodeMirrorBlocks = missing("CodeMirrorBlocks", "the entry point and its constructor options");
(CodeMirrorBlocks as unknown as Record<string, unknown>).fromTextArea = missing("CodeMirrorBlocks.fromTextArea", "the entry point");
export default CodeMirrorBlocks;
export type Pos = { line: number; ch: number };
