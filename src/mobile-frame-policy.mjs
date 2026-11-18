/**
 * Gate the entire mobile scene update, not just renderer.render().
 * Event handlers call wake(now) when a style/content/asset change needs a frame.
 * A cheap signature (scroll position, viewport size and UI state) catches changes
 * even when no event is delivered. Never include per-frame animation output in it.
 */
export function createMobileFramePolicy({ idleHz = 1, liveHz = 30, interactionHz = 60, settleMs = 900 } = {}) {
  if (![idleHz, liveHz, interactionHz].every(hz => Number.isFinite(hz) && hz > 0) || !Number.isFinite(settleMs) || settleMs < 0) {
    throw new RangeError('Frame rates must be positive and settling time must be nonnegative.');
  }
  let lastFrame = -Infinity, activeUntil = -Infinity, previousSignature, hadSignature = false;
  const wake = (now, durationMs = settleMs) => {
    // A shorter wake never cancels a longer animation that is still settling.
    activeUntil = Math.max(activeUntil, now + Math.max(0, durationMs));
  };
  return {
    wake,
    shouldFrame(now, { mobile, hidden = false, first = false, signature, live = false, interactive = false } = {}) {
      if (hidden) return false;
      if (!mobile) return true; // Preserve the desktop frame loop.
      const changed = !hadSignature || signature !== previousSignature;
      if (changed) { previousSignature = signature; hadSignature = true; wake(now); }
      const hz = interactive || now < activeUntil ? interactionHz : live ? liveHz : idleHz;
      // Dirty/signature changes paint immediately, even just after the last frame.
      // wake() itself keeps a settling window but obeys the interactive frame cap.
      const due = first || changed || now - lastFrame + 0.1 >= 1000 / hz;
      if (due) lastFrame = now;
      return due;
    },
  };
}
