const beepSound = require('./beep.wav');
export const BEEP = new Audio(beepSound);
export const WRAP = BEEP; // eventually use a different sound for this

export function playSound(sound) {
  sound.pause();
  console.log("BEEP!");
  if (sound.readyState > 0) sound.currentTime = 0;
  // Resolves race condition. See https://stackoverflow.com/questions/36803176
  setTimeout(() =>  sound.play(), 50);
}
