import { Language } from "../../CodeMirrorBlocks";

interface WeschemeParser {
  new (): Language;
}

declare const parser: WeschemeParser;
export default parser;
