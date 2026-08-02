import { createPhaserGame } from './game/PhaserGame';

// Kick the Duelyst UI font (Lato) so Phaser's first text render isn't a fallback.
if (document.fonts?.load) {
  document.fonts.load('400 16px Lato');
  document.fonts.load('700 16px Lato');
}

createPhaserGame();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
