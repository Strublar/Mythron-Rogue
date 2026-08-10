import Phaser from 'phaser';

/**
 * The prismatic cast flourish, ported from Duelyst's `PrismaticPlayCardNode`: a gradient
 * floor blooms, three soft rays and three hard rays rise on staggered delays, and the
 * `prismatic_card` particle system throws sparks upward. Every number below is the
 * original's — positions and offsets are negated because Phaser's y axis points down.
 */

/** `_animationDuration` — every ray runs on this one clock. */
const DURATION = 500;
/** `_rayOpacity: 127.0` on Cocos' 0–255 scale. */
const RAY_ALPHA = 0.45;
/**
 * `_rayScale: 0.5`, trimmed a touch: the hard rays are up to 700px of source art and the
 * reveal panel is only 520 tall, so anything larger runs straight off the top of it.
 */
const RAY_SCALE = 0.45;
/**
 * Duelyst spaced these across a battlefield tile; on a 560px panel the original offsets put
 * all six rays on top of each other, and three additive channels stacked just make white.
 * Fanning them out is what lets the red / green / blue read as separate beams.
 */
const RAY_SPREAD = 2.2;
/** Sparks outlive the rays, so the whole burst is cleaned up on the longest of the two. */
const TEARDOWN_MS = 1600;

interface RaySpec {
  /** Texture key suffix — the burst fires one ray per channel. */
  key: string;
  /** Anchor offset, Cocos-side. Negated on the y axis when placed. */
  bx: number;
  by: number;
  /** How far the ray climbs over `DURATION`. */
  rise: number;
  delay: number;
}

const SOFT_RAYS: RaySpec[] = [
  { key: 'prismatic_ray_soft_red', bx: -40, by: 0, rise: 80, delay: 50 },
  { key: 'prismatic_ray_soft_green', bx: 0, by: 10, rise: 100, delay: 75 },
  { key: 'prismatic_ray_soft_blue', bx: 40, by: 0, rise: 90, delay: 100 },
];

const HARD_RAYS: RaySpec[] = [
  { key: 'prismatic_ray_hard_red', bx: 10, by: 0, rise: 250, delay: 150 },
  { key: 'prismatic_ray_hard_green', bx: 30, by: 0, rise: 160, delay: 175 },
  { key: 'prismatic_ray_hard_blue', bx: -35, by: 0, rise: 200, delay: 200 },
];

/**
 * Fires the burst at `(x, y)`. Returns everything it spawned so a caller that redraws its
 * panel can tear the burst down early; otherwise it cleans itself up after `TEARDOWN_MS`.
 */
export function prismaticBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth: number,
): Phaser.GameObjects.GameObject[] {
  const spawned: Phaser.GameObjects.GameObject[] = [
    addFloor(scene, x, y, depth),
    ...SOFT_RAYS.map(spec => addSoftRay(scene, x, y, depth, spec)),
    ...HARD_RAYS.map(spec => addHardRay(scene, x, y, depth, spec)),
    addSparks(scene, x, y, depth),
  ];
  scene.time.delayedCall(TEARDOWN_MS, () => {
    for (const o of spawned) o.destroy();
  });
  return spawned;
}

/** `_showFloorGradient`: the rainbow pool under the card, in and back out. */
function addFloor(
  scene: Phaser.Scene, x: number, y: number, depth: number,
): Phaser.GameObjects.Image {
  const floor = scene.add
    .image(x, y, 'prismatic_gradients')
    .setScale(0.65)
    .setAlpha(0)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: floor,
    alpha: { from: 0, to: 1 },
    duration: DURATION,
    yoyo: true,
    ease: 'Cubic.easeOut',
  });
  // The original swaps in a voronoi shader here; a slow turn keeps the pool from reading flat.
  scene.tweens.add({
    targets: floor,
    rotation: Math.PI * 0.5,
    duration: DURATION * 2,
    ease: 'Sine.easeOut',
  });
  return floor;
}

/** `_showSoftRay`: fades up while it climbs, then fades out over the back half. */
function addSoftRay(
  scene: Phaser.Scene, x: number, y: number, depth: number, spec: RaySpec,
): Phaser.GameObjects.Image {
  const ray = placeRay(scene, x, y, depth, spec, spec.rise);
  ray.setAlpha(0).setScale(RAY_SCALE, RAY_SCALE * 0.75);
  scene.tweens.add({
    targets: ray,
    y: y - spec.by,
    duration: DURATION,
    delay: spec.delay,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({
    targets: ray,
    scaleY: RAY_SCALE,
    duration: DURATION,
    delay: spec.delay,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: ray,
    alpha: { from: 0, to: RAY_ALPHA },
    duration: DURATION / 2,
    delay: spec.delay,
    yoyo: true,
  });
  return ray;
}

/** `_showHardRay`: starts lit and stretches out fast, then drops away. */
function addHardRay(
  scene: Phaser.Scene, x: number, y: number, depth: number, spec: RaySpec,
): Phaser.GameObjects.Image {
  const ray = placeRay(scene, x, y, depth, spec, spec.rise * 0.2);
  ray.setAlpha(RAY_ALPHA).setScale(RAY_SCALE, RAY_SCALE * 0.5);
  scene.tweens.add({
    targets: ray,
    y: y - spec.by,
    duration: DURATION,
    delay: spec.delay,
    ease: 'Cubic.easeIn',
  });
  scene.tweens.add({
    targets: ray,
    scaleY: RAY_SCALE,
    duration: DURATION,
    delay: spec.delay,
    ease: 'Expo.easeOut',
  });
  scene.tweens.add({
    targets: ray,
    alpha: 0,
    duration: DURATION * 0.4,
    delay: spec.delay + DURATION / 2,
    ease: 'Cubic.easeOut',
  });
  return ray;
}

/** Shared placement: bottom-centred anchor, dropped `drop` below its resting position. */
function placeRay(
  scene: Phaser.Scene, x: number, y: number, depth: number, spec: RaySpec, drop: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(x + spec.bx * RAY_SPREAD, y - spec.by + drop, spec.key)
    .setOrigin(0.5, 1)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD);
}

/**
 * `prismatic_card.plist`, translated: 30 sparks over half a second, thrown upward and
 * accelerating (Cocos' `gravityy: 500` points up), shrinking and fading as they go.
 *
 * The plist's speed and 0° angle variance were authored against a battlefield tile, where the
 * sparks have room to spread. Fired into a 520px panel they overshoot it in a single column
 * that reads as one white beam, so the throw is slowed and the cone widened to match the
 * intent — a shower — rather than the literal numbers.
 */
function addSparks(
  scene: Phaser.Scene, x: number, y: number, depth: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(x, y, 'prismatic_spark', {
    lifespan: { min: 300, max: 600 },
    speed: { min: 90, max: 190 },
    angle: { min: -125, max: -55 },
    gravityY: -260,
    // The plist sizes are pixels; the source streak is 123px tall.
    scale: { start: 80 / 123, end: 50 / 123 },
    alpha: { start: 0.8, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    emitZone: {
      type: 'random',
      source: new Phaser.Geom.Rectangle(-70, -20, 140, 40),
      quantity: 1,
    },
    quantity: 2,
    frequency: 30,
    maxParticles: 30,
    duration: DURATION,
  }).setDepth(depth);
}
