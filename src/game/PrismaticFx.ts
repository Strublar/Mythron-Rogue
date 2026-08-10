import Phaser from 'phaser';

/**
 * Duelyst's prismatic (foil) treatment, ported from CC0 assets and the original sources:
 * `app/ui/styles/common/cards.scss` for the counter-rotating gradients and
 * `mixins.scss@move-shine-prismatic` for the shine sweep.
 *
 * The art lives in `public/resources/prismatic/` — nothing here is procedural except the
 * shine band, which has no asset because Duelyst drew it with a CSS gradient.
 */

/** Texture key → path. BootScene preloads the whole map; the fx read it by key. */
export const PRISMATIC_TEXTURES: Record<string, string> = {
  prismatic_grad_red: 'resources/prismatic/prismatic_gradient_red.png',
  prismatic_grad_green: 'resources/prismatic/prismatic_gradient_green.png',
  prismatic_grad_blue: 'resources/prismatic/prismatic_gradient_blue.png',
  prismatic_gradients: 'resources/prismatic/prismatic_gradients.png',
  prismatic_ray_soft_red: 'resources/prismatic/prismatic_ray_soft_red.png',
  prismatic_ray_soft_green: 'resources/prismatic/prismatic_ray_soft_green.png',
  prismatic_ray_soft_blue: 'resources/prismatic/prismatic_ray_soft_blue.png',
  prismatic_ray_hard_red: 'resources/prismatic/prismatic_ray_hard_red.png',
  prismatic_ray_hard_green: 'resources/prismatic/prismatic_ray_hard_green.png',
  prismatic_ray_hard_blue: 'resources/prismatic/prismatic_ray_hard_blue.png',
  prismatic_spark: 'resources/prismatic/prismatic_card.png',
};

/** The colour a prismatic frame/label takes — white, so it reads apart from the gold. */
export const PRISMATIC_WHITE = '#ffffff';

/**
 * One orbiting gradient. `dx`/`dy` are the image centre's offset from the pivot in units of
 * the pivot radius, straight out of the SCSS `transform-origin` / `margin` pairs. Note the
 * class names and the files they load are shuffled in the original — keep the pairing.
 */
const ORBITS = [
  { key: 'prismatic_grad_red', dx: -0.7, dy: 0.7, duration: 10000, dir: 1 },
  { key: 'prismatic_grad_blue', dx: 0, dy: -1, duration: 15000, dir: -1 },
  { key: 'prismatic_grad_green', dx: 0.7, dy: 0.7, duration: 20000, dir: 1 },
] as const;

/** SCSS `$prismaticRadius: $prismaticSize * 0.1` — how far off-centre each blob pivots. */
const ORBIT_RADIUS = 0.1;
/**
 * SCSS puts each layer at `opacity: 0.7` inside a wrapper at `opacity: 0.5`. Additive
 * blending over a near-black panel is far hotter than CSS colour-dodge over card art, so
 * this is the composed figure rather than the layer one — any higher and it eats the text.
 */
const ORBIT_ALPHA = 0.35;
/**
 * Blob size relative to the panel's long edge. The gradient falls off to nothing well
 * inside its canvas, so covering the long edge is enough — and every extra percent here is
 * additive fill across every card on the screen at once.
 */
const SWIRL_OVERSCAN = 1;

const SHINE_KEY = 'prismatic_shine';
const SHINE_SIZE = 128;
/** `move-shine-prismatic` runs on an 8s loop and the band itself crosses in the 10–30% slice. */
const SHINE_CYCLE_MS = 8000;
const SHINE_SWEEP_MS = 1600;

/**
 * The prismatic layer for a rectangular panel: three additive gradients orbiting on
 * different periods, plus the periodic shine band, clipped to the rect.
 *
 * Returns the container that owns everything — destroy it and the tweens and mask go too.
 */
export function prismaticSwirl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(depth);
  const tweens: Phaser.Tweens.Tween[] = [];

  const size = Math.max(w, h) * SWIRL_OVERSCAN;
  const r = size * ORBIT_RADIUS;
  for (const orbit of ORBITS) {
    // Origin doubles as the rotation pivot in Phaser, so shifting it off 0.5 makes the blob
    // orbit the card centre instead of spinning in place — what the CSS pivots buy.
    const blob = scene.add
      .image(0, 0, orbit.key)
      .setOrigin(0.5 - (orbit.dx * r) / size, 0.5 - (orbit.dy * r) / size)
      .setDisplaySize(size, size)
      .setAlpha(ORBIT_ALPHA)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.add(blob);
    // A random phase per blob: without it every card on a grid shimmers in lockstep and the
    // whole page reads as one flat wash. Relative `from`/`to` keeps the speed constant across
    // repeats, which a bare `to` would not once the start angle is no longer zero.
    const start = Math.random() * Math.PI * 2;
    tweens.push(scene.tweens.add({
      targets: blob,
      rotation: { from: start, to: start + orbit.dir * Math.PI * 2 },
      duration: orbit.duration,
      repeat: -1,
      ease: 'Linear',
    }));
  }

  const shine = addShine(scene, container, w, h);
  if (shine) tweens.push(shine);

  // Clip to the card. The mask graphics is not a display-list child, so it has to be torn
  // down by hand — and the tweens outlive their target unless removed explicitly.
  const shape = scene.make.graphics({}, false);
  shape.fillStyle(0xffffff).fillRect(x - w / 2, y - h / 2, w, h);
  container.setMask(shape.createGeometryMask());
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    for (const t of tweens) t.remove();
    shape.destroy();
  });

  return container;
}

/** The diagonal white band sweeping bottom-to-top, held between passes. */
function addShine(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  w: number,
  h: number,
): Phaser.Tweens.Tween | undefined {
  if (!ensureShineTexture(scene)) return undefined;
  const band = scene.add
    .image(0, 0, SHINE_KEY)
    .setDisplaySize(w, h * 1.5)
    .setAlpha(0)
    // It only crosses for 1.6s of every 8s; the rest of the time it must not cost a quad.
    .setVisible(false)
    .setBlendMode(Phaser.BlendModes.SCREEN);
  container.add(band);

  return scene.tweens.add({
    targets: band,
    y: { from: h * 0.75, to: -h * 0.75 },
    duration: SHINE_SWEEP_MS,
    ease: 'Sine.easeIn',
    repeat: -1,
    repeatDelay: SHINE_CYCLE_MS - SHINE_SWEEP_MS,
    // The CSS fades the band in and back out inside its own pass; a sine hump is that curve.
    // Visibility rides the same value, so the band switches itself off across the long wait
    // (the pass ends at alpha 0, and no update runs again until the next sweep starts).
    onUpdate: t => {
      const a = Math.sin(t.progress * Math.PI);
      band.setAlpha(a).setVisible(a > 0.01);
    },
  });
}

/** Draws the `linear-gradient(135deg, …)` band once into a shared canvas texture. */
function ensureShineTexture(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(SHINE_KEY)) return true;
  const texture = scene.textures.createCanvas(SHINE_KEY, SHINE_SIZE, SHINE_SIZE);
  if (!texture) return false;
  const ctx = texture.getContext();
  const grad = ctx.createLinearGradient(0, 0, SHINE_SIZE, SHINE_SIZE);
  grad.addColorStop(0.27, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.71, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SHINE_SIZE, SHINE_SIZE);
  texture.refresh();
  return true;
}
