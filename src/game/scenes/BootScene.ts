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
    // Combat scene assets
    this.load.image('combat_bg',     'resources/maps/battlemap0_background.png');
    this.load.image('combat_mid',    'resources/maps/battlemap0_middleground.png');
    this.load.image('tile_board',    'resources/tiles/tile_board.png');
    this.load.image('tile_hover',    'resources/tiles/tile_hover.png');
    this.load.image('tile_attack',   'resources/tiles/tile_attack.png');
    this.load.image('tile_grid',     'resources/tiles/tile_grid.png');
    this.load.image('bottom_bar',    'resources/ui/bottom_bar_background.png');
    this.load.image('bracket_p',     'resources/ui/bracket_friendly.png');
    this.load.image('bracket_e',     'resources/ui/bracket_enemy.png');
    this.load.image('icon_mana',     'resources/ui/icon_mana.png');
    this.load.image('icon_mana_off', 'resources/ui/icon_mana_inactive.png');
    this.load.image('icon_hp',       'resources/ui/icon_general_hp.png');
    this.load.image('btn_end_mine',  'resources/ui/button_end_turn_mine.png');
    this.load.image('btn_end_enemy', 'resources/ui/button_end_turn_enemy.png');
    this.load.image('notif_yours',   'resources/ui/notification_your_turn.png');
    this.load.image('notif_enemy',   'resources/ui/notification_enemy_turn.png');
    this.load.image('status_panel',  'resources/ui/status_panel.png');
    // Duelyst hand card frames (neutral), rarity strips, stat gems + directional tooltip bubbles.
    this.load.image('card_frame_unit',     'resources/card_backgrounds/neutral_unit.png');
    this.load.image('card_frame_spell',    'resources/card_backgrounds/neutral_spell.png');
    this.load.image('card_frame_artifact', 'resources/card_backgrounds/neutral_artifact.png');
    this.load.image('rarity_common',    'resources/ui/collection_card_rarity_common.png');
    this.load.image('rarity_rare',      'resources/ui/collection_card_rarity_rare.png');
    this.load.image('rarity_epic',      'resources/ui/collection_card_rarity_epic.png');
    this.load.image('rarity_legendary', 'resources/ui/collection_card_rarity_legendary.png');
    this.load.image('rarity_mythron',   'resources/ui/collection_card_rarity_mythron.png');
    this.load.image('stats_atk_bg', 'resources/card_backgrounds/stats_atk_bg.png');
    this.load.image('stats_hp_bg',  'resources/card_backgrounds/stats_hp_bg.png');
    this.load.image('tooltip_up',    'resources/tutorial/tooltip_up.png');
    this.load.image('tooltip_down',  'resources/tutorial/tooltip_down.png');
    this.load.image('tooltip_left',  'resources/tutorial/tooltip_left.png');
    this.load.image('tooltip_right', 'resources/tutorial/tooltip_right.png');
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
