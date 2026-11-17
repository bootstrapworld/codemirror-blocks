/** stands for the old `src/utils`'s sound part: a test spies on `playSound`; `mountCMB` makes the editor's sounds call it with the old names (`BEEP`, `WRAP`) */
export const BEEP = "beep";
export const WRAP = "wrap";
export function playSound(_sound: string): void {}
