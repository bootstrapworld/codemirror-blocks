import { Language } from "../../CodeMirrorBlocks";

interface WeschemeParser {
  new (): Required<Language>;
}

declare const parser: WeschemeParser;
export default parser;
