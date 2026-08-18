import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { TeamScene } from './scenes/TeamScene';
import { ShopScene } from './scenes/ShopScene';
import { BossFightScene } from './scenes/BossFightScene';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

export function createPhaserGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#05060f',
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MainMenuScene, TeamScene, ShopScene, BossFightScene],
  });
}
