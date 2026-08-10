import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

/** The three text colours every card and panel is written in. */
export const UI_GOLD = '#ffd76b';
export const UI_CREAM = '#f3e6c8';
export const UI_MUTED = '#9aa3b8';

/** The dimmed battlefield backdrop every between-run screen sits on. */
export function drawSceneBackground(scene: Phaser.Scene): void {
  for (const key of ['combat_bg', 'combat_mid']) {
    const img = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
    img.setScale(Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height));
  }
  scene.add.graphics().fillStyle(0x05060f, 0.82).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

/** Centred stroked caption — the shared text style of the between-run screens. */
export function sceneLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string,
  style = '',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: 'Lato', fontSize: `${size}px`, color, fontStyle: style,
      stroke: '#000000', strokeThickness: 4,
    })
    .setOrigin(0.5);
}

export interface ButtonHandle {
  /** Disabled buttons dim and stop taking presses. */
  setEnabled(on: boolean): void;
}

/** Shared `btn_confirm` button: glow on hover, label centred, one press handler. */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onPress: () => void,
  depth = 0,
): ButtonHandle {
  const glow = scene.add.image(x, y, 'btn_confirm_glow').setAlpha(0).setDepth(depth);
  const btn = scene.add.image(x, y, 'btn_confirm').setInteractive({ useHandCursor: true }).setDepth(depth);
  const text = scene.add
    .text(x, y, label, { fontFamily: 'Lato', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setDepth(depth + 1);

  btn.on('pointerover', () => {
    glow.setAlpha(1);
    text.setColor('#ffe080');
  });
  btn.on('pointerout', () => {
    glow.setAlpha(0);
    text.setColor('#ffffff');
  });
  btn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onPress);

  return {
    setEnabled(on: boolean): void {
      if (btn.input) btn.input.enabled = on;
      btn.setAlpha(on ? 1 : 0.4);
      text.setAlpha(on ? 1 : 0.4);
      if (!on) {
        glow.setAlpha(0);
        text.setColor('#ffffff');
      }
    },
  };
}
