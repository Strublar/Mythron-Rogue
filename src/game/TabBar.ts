import Phaser from 'phaser';

const TAB_H = 38;
const GAP = 8;
const ACTIVE_BG = 0x1b2140;
const IDLE_BG = 0x0b0d18;
const GOLD = 0xffd76b;

export interface TabBarHandle {
  /** Redraws the highlight — call after switching tabs from elsewhere. */
  select(index: number): void;
}

/**
 * Row of pill tabs, centred on `x`. The shop switches its offer table with it; the bar
 * only draws state and reports presses.
 */
export function createTabBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  labels: string[],
  active: number,
  onSelect: (index: number) => void,
  width = 180,
  depth = 0,
): TabBarHandle {
  const span = labels.length * width + (labels.length - 1) * GAP;
  const boxes: Phaser.GameObjects.Rectangle[] = [];
  const texts: Phaser.GameObjects.Text[] = [];

  labels.forEach((label, i) => {
    const cx = x - span / 2 + width / 2 + i * (width + GAP);
    const box = scene.add
      .rectangle(cx, y, width, TAB_H, IDLE_BG, 0.95)
      .setStrokeStyle(2, GOLD, 0.5)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });
    const text = scene.add
      .text(cx, y, label, { fontFamily: 'Lato', fontSize: '18px', fontStyle: 'bold', color: '#9aa3b8' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    box.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => onSelect(i));
    boxes.push(box);
    texts.push(text);
  });

  const paint = (index: number): void => {
    boxes.forEach((box, i) => {
      const on = i === index;
      box.setFillStyle(on ? ACTIVE_BG : IDLE_BG, 0.95).setStrokeStyle(2, GOLD, on ? 1 : 0.5);
      texts[i].setColor(on ? '#ffd76b' : '#9aa3b8');
    });
  };
  paint(active);

  return { select: paint };
}
