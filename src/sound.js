const beepSound = require('./beep.wav');
export const BEEP = new Audio(beepSound);
BEEP.crossorigin = "anonymous";
export const WRAP = BEEP; // eventually use a different sound for this

export function playSound(sound) {
  sound.pause();
  console.log("BEEP!");
  if (sound.readyState > 0) sound.currentTime = 0;
  // Resolves race condition. See https://stackoverflow.com/questions/36803176
  setTimeout(() =>  {
    var playPromise = sound.play();
    // Promise handling from: https://goo.gl/xX8pDD
    // In browsers that don’t yet support this functionality,
    // playPromise won’t be defined.
    if (playPromise !== undefined) {
      playPromise
        .then(  () => {}) // Automatic playback started!
        .catch( () => {});// Automatic playback failed.
    }
  }, 50);
}
