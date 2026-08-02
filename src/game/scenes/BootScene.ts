import Phaser from 'phaser';
import { UNIT_DEFS } from '../UnitAnimator';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.loadUnitAtlases();
    this.load.image('menu_bg', 'resources/scenes/shimzar/bg.jpg');
    this.load.image('menu_midground', 'resources/scenes/shimzar/midground.png');
    this.load.image('menu_vignette', 'resources/scenes/shimzar/vignette.png');
    this.load.image('menu_portrait', 'resources/generals/general_f5.png');
    this.load.image('btn_confirm', 'resources/ui/button_confirm.png');
    this.load.image('btn_confirm_glow', 'resources/ui/button_confirm_glow.png');
    // Boss fight backdrop
    this.load.image('combat_bg',  'resources/maps/battlemap0_background.png');
    this.load.image('combat_mid', 'resources/maps/battlemap0_middleground.png');
  }

  private loadUnitAtlases(): void {
    for (const [unitKey, def] of Object.entries(UNIT_DEFS)) {
      const base = `resources/units/${unitKey}`;
      this.load.atlas(def.atlasKey, `${base}.png`, `${base}_atlas.json`);
    }
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
