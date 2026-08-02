import Phaser from 'phaser';

/** Shared `btn_confirm` button: glow on hover, label centred, one press handler. */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onPress: () => void,
  depth = 0,
): void {
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
}
