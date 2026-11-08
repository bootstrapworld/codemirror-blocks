import type { Program } from "./structures";
export declare function lex(
  str: string,
  strSource?: string,
  debug?: boolean
): Program[];
/** `lex`, and every comment that was skipped, as `{from, to}` offsets in the source */
export declare function lexWithComments(
  str: string,
  strSource?: string
): { sexps: Program[]; comments: { from: number; to: number }[] };
