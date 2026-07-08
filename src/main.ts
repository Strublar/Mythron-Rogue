// TODO: Boot entry point.
// 1. Create PhaserGame instance (attaches canvas to document.body)
// 2. Mount React <App /> into #app div (HTML overlay above canvas)
// 3. Wire ProgressionSystem events → React screen transitions

import { createPhaserGame } from './game/PhaserGame';
import { mountReactApp } from './ui/App';

// Kick the Duelyst UI font (Lato) so Phaser's first text render isn't a fallback.
if (document.fonts?.load) {
  document.fonts.load('400 16px Lato');
  document.fonts.load('700 16px Lato');
}

createPhaserGame();
mountReactApp(document.getElementById('app')!);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
