/** stands for the old `src/utils`'s sound part: a test spies on `playSound`; `mountCMB` makes the editor's sounds call it with the old names (`BEEP`, `WRAP`) */
export const BEEP = "beep";
export const WRAP = "wrap";
export function playSound(_sound: string): void {}
/** the old `utils.debugLog` and `utils.logResults` (the error notice that offers to report an error is not built here) */
export function debugLog(..._a: unknown[]): void {}
export function logResults(_e: unknown): never {
  throw new Error("not in the compat layer: logResults (the error notice that offers to report an error is not built)");
}
