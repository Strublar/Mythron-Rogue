/**
 * Portrait enforcement.
 *
 * The PWA manifest's `"orientation": "portrait"` only binds an *installed* app;
 * in a plain browser tab the page happily follows the device. So:
 *   1. ask the Screen Orientation API for a real lock (Android/Chromium, fullscreen only),
 *   2. fall back to the CSS overlay in index.html, which covers the canvas on
 *      landscape touch screens until the player rotates back.
 */

type OrientationLock = ScreenOrientation & {
  lock?: (orientation: 'portrait') => Promise<void>;
};

/** Best-effort native lock. Silently ignored where unsupported (iOS, desktop, non-fullscreen). */
export function lockPortrait(): void {
  const orientation = screen.orientation as OrientationLock | undefined;
  orientation?.lock?.('portrait').catch(() => {
    /* unsupported or not fullscreen — the CSS overlay handles it */
  });
}

/**
 * Retry the lock after the first user gesture: browsers only grant it while
 * fullscreen, and fullscreen itself requires a gesture.
 */
export function lockPortraitOnFirstGesture(): void {
  // Touch screens only — never yank a desktop browser into fullscreen on a click.
  if (!matchMedia('(pointer: coarse)').matches) return;

  const onGesture = () => {
    document.documentElement.requestFullscreen?.().then(lockPortrait).catch(() => lockPortrait());
  };
  window.addEventListener('pointerdown', onGesture, { once: true });
}
