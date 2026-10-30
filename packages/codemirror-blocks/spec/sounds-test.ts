import * as fs from "fs";
import * as path from "path";
import { BEEP_URL, WRAP_URL } from "../src/sounds";
import { BEEP, WRAP } from "../src/utils";

/**
 * The beep and the wrap sound are inlined as data URLs (src/sounds.ts, made by
 * `npm run build-sounds`), so that importing the library needs no bundler rule
 * for audio files.
 */
const sounds = path.join(__dirname, "../assets/sounds");
const prefix = "data:audio/mpeg;base64,";
const bytes = (url: string) => Buffer.from(url.slice(prefix.length), "base64");

describe.each([
  ["beep.mp3", BEEP_URL, BEEP],
  ["wrap.mp3", WRAP_URL, WRAP],
])("%s", (file, url, audio) => {
  it("is inlined as an audio/mpeg data URL", () => {
    expect(url.startsWith(prefix)).toBe(true);
    expect(url.length).toBeGreaterThan(prefix.length + 100);
  });

  it("is the file in assets/sounds, so that src/sounds.ts is not out of date", () => {
    expect(bytes(url).equals(fs.readFileSync(path.join(sounds, file)))).toBe(
      true
    );
  });

  it("looks like an MP3: an ID3 tag or an MPEG frame", () => {
    const head = bytes(url);
    const id3 = head.subarray(0, 3).toString("latin1") === "ID3";
    const frame = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
    expect(id3 || frame).toBe(true);
  });

  it("is what the sound plays", () => {
    expect(audio.src).toBe(url);
  });
});
