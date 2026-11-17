/*
 * EXPERIMENT (eighth round). The sounds of the old editor: a short beep for "no" and a rising sound for "the search wrapped around".
 * The audio is the old package's two MP3 files, copied unchanged (assets/sounds, inlined as data URLs in sounds.ts by
 * scripts/inline-sounds.js, so no bundler rule for audio is needed). The old editor plays them with `new Audio(url)` and `play()`; so does the
 * default player here, with the same interruption rule (a sound that is still playing is not started again).
 *
 * The editor does not play anything itself: it calls `ed.sound(name, event)`, which asks the PLAYER of the options (`playSound`). A test
 * passes a player that records what was asked; the demo page uses the default one. `sounds: false` (or `ed.setSounds(false)`) silences it.
 */
import { BEEP_URL, WRAP_URL } from "./sounds";

export type SoundName = "beep" | "wrap";

/**
 * Why a sound was asked for (every place the old editor plays one, where this editor has the event):
 *  - "no-previous" / "no-next": Up / Down with no block before / after (old: Previous Block / Next Block)
 *  - "no-parent": Left on a top-level block that cannot collapse; "no-child": Right on a block with nothing inside
 *  - "collapse-root": Shift-Alt-Left on a top-level block that is collapsed already or has nothing inside
 *  - "no-ancestors": `\` on a top-level block
 *  - "select-refused": Space on a block inside a selected one, or on one that holds selected ones twice
 *  - "delete-nothing": Delete or Backspace with nothing selected (here only: the old editor says "Nothing selected" without a sound)
 *  - "cut-nothing": Ctrl/Cmd-X with no block selected (CHANGED from the old editor, which only says "Nothing selected")
 *  - "paste-refused": a paste where the block's list cannot take it ("Cannot paste after this node.")
 *  - "comment-of-comment": Shift-Ctrl-] on a comment block
 *  - "left-blank": an edit that deletes a block that has to be there (a "one" slot) and leaves a hole
 *  - "drop-nowhere" / "drop-refused": a drag let go where nothing can take it / where the editor refused it
 *  - "no-match": search found nothing, or there is nothing to search for yet
 *  - "wrapped": search went on from the other end of the document (the one use of the "wrap" sound)
 */
export type SoundEvent =
  | "no-previous"
  | "no-next"
  | "no-parent"
  | "no-child"
  | "collapse-root"
  | "no-ancestors"
  | "select-refused"
  | "delete-nothing"
  | "cut-nothing"
  | "paste-refused"
  | "comment-of-comment"
  | "left-blank"
  | "drop-nowhere"
  | "drop-refused"
  | "no-match"
  | "wrapped";

/** what plays a sound: the default is `browserPlayer()`; tests pass one that records */
export type SoundPlayer = (sound: SoundName, event: SoundEvent) => void;

/**
 * The player of a browser: one `Audio` for each sound, made when it is first needed. It fails quietly: no `Audio` (a server, jsdom), a
 * page that has not been touched yet (the browser's autoplay rule: `navigator.userActivation` says so, and `play()` would reject anyway),
 * a rejected `play()` (blocked, or interrupted by the next sound), anything thrown.
 */
export function browserPlayer(): SoundPlayer {
  const audios = new Map<
    SoundName,
    HTMLAudioElement & { isPlaying?: boolean }
  >();
  return (sound) => {
    try {
      if (typeof Audio === "undefined" || typeof navigator === "undefined")
        return;
      if (/jsdom/i.test(navigator.userAgent)) return; // (no audio there: play() only prints "not implemented")
      const ua = (
        navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
      ).userActivation;
      if (ua && !ua.hasBeenActive) return; // (before the first click or key: the browser would refuse)
      let a = audios.get(sound);
      if (!a) {
        a = new Audio(
          sound === "beep" ? BEEP_URL : WRAP_URL
        ) as HTMLAudioElement & { isPlaying?: boolean };
        a.onplaying = () => (a!.isPlaying = true);
        a.onpause = () => (a!.isPlaying = false);
        audios.set(sound, a);
      }
      a.pause();
      if (!(a.paused && !a.isPlaying)) return;
      if (a.readyState > 0) a.currentTime = 0;
      a.play()?.catch(() => undefined);
    } catch {
      /* a missing sound is harmless */
    }
  };
}
