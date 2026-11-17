// Keep phone detail sharp with a 2–2.5x framebuffer on Retina screens.
// Bound fill cost on phones and large tablets; never degrade quality after startup.
export function mobilePixelRatio(width, height, nativeRatio) {
  const native = Math.max(1, nativeRatio || 1);
  const budget = Math.sqrt(4_000_000 / Math.max(1, width * height));
  return Math.min(native, 2.5, Math.max(2, budget));
}

// Only the opaque, fully assembled dial can hide the rear movement. Aperture discs
// live in a separate group and remain visible; exposed, side and rear views never cull.
export function movementIsCovered(mobile, facing, dialZ, movementZ, dialOpacity, caseOpacity) {
  return mobile && facing > 0.65 && Math.abs(dialZ) < 0.1 && Math.abs(movementZ) < 0.1 && dialOpacity > 0.999 && caseOpacity > 0.999;
}

// Reuse a deformed strap until its change accumulates to 0.01 mm (well below a
// screen pixel). Check buffer versions too: flight animations also write this mesh.
export function ribbonNeedsUpdate(geometry, center, width, thickness, side, flat) {
  const n = center.length, version = geometry.attributes.position.version;
  let cache = geometry.userData.mobileRibbon;
  const reset = !cache || cache.values.length !== n * 4;
  if (reset) cache = geometry.userData.mobileRibbon = { values: new Float64Array(n * 4), scratch: new Float64Array(n * 4) };
  let changed = reset || cache.version !== version || cache.side !== side || cache.flat !== flat;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1), k = i * 4;
    cache.scratch[k] = center[i][0]; cache.scratch[k + 1] = center[i][1];
    cache.scratch[k + 2] = width(t); cache.scratch[k + 3] = thickness(t);
    for (let j = 0; j < 4; j++) if (Math.abs(cache.scratch[k + j] - cache.values[k + j]) >= 0.01) changed = true;
  }
  if (changed) { cache.values.set(cache.scratch); cache.version = version + 1; cache.side = side; cache.flat = flat; }
  return changed;
}

export function shadowUpdateDue(mobile, now, lastUpdate, first) {
  return !mobile || first || now - lastUpdate >= 1000 / 30;
}
