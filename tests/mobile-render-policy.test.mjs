import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mobilePixelRatio, movementIsCovered, ribbonNeedsUpdate, shadowUpdateDue } from '../src/mobile-render-policy.mjs';

test('phone rendering retains high-density detail without a one-way low-resolution fallback', () => {
  assert.equal(mobilePixelRatio(390, 844, 3), 2.5);
  assert.equal(mobilePixelRatio(430, 932, 3), 2.5);
  assert.equal(mobilePixelRatio(390, 844, 2), 2);
  assert.equal(mobilePixelRatio(390, 844, 1), 1);
  assert.equal(mobilePixelRatio(800, 1280, 3), 2);
  assert.equal(mobilePixelRatio(390, 844, 4), 2.5);
});

test('movement culling never hides rear, side, exploded, transparent or desktop views', () => {
  assert.equal(movementIsCovered(true, .9, 0, 0, 1, 1), true);
  assert.equal(movementIsCovered(false, .9, 0, 0, 1, 1), false);
  for (const facing of [-1, 0, .65]) assert.equal(movementIsCovered(true, facing, 0, 0, 1, 1), false);
  assert.equal(movementIsCovered(true, .9, 11, 0, 1, 1), false);
  assert.equal(movementIsCovered(true, .9, 0, 1, 1, 1), false);
  assert.equal(movementIsCovered(true, .9, 0, 0, .99, 1), false);
  assert.equal(movementIsCovered(true, .9, 0, 0, 1, .99), false);
});

test('strap cache accumulates subpixel movement and invalidates external flight writes', () => {
  const geo = {userData: {}, attributes: {position: {version: 0}}};
  const points = [[0,0], [1,2], [2,4]], width = () => 20, thickness = () => 3;
  assert.equal(ribbonNeedsUpdate(geo, points, width, thickness, 1, false), true);
  geo.attributes.position.version++;
  assert.equal(ribbonNeedsUpdate(geo, points, width, thickness, 1, false), false);
  points[2][1] += .006;
  assert.equal(ribbonNeedsUpdate(geo, points, width, thickness, 1, false), false);
  points[2][1] += .006;
  assert.equal(ribbonNeedsUpdate(geo, points, width, thickness, 1, false), true);
  geo.attributes.position.version++;
  assert.equal(ribbonNeedsUpdate(geo, points, width, thickness, 1, false), false);
  geo.attributes.position.version++; // NATO flight wrote the buffer independently
  assert.equal(ribbonNeedsUpdate(geo, points, width, thickness, 1, false), true);
  geo.attributes.position.version++;
  assert.equal(ribbonNeedsUpdate(geo, points, () => 19, thickness, 1, false), true);
});

test('mobile shadow refresh has a bounded cadence and desktop keeps every update', () => {
  assert.equal(shadowUpdateDue(true, 16, 0, false), false);
  assert.equal(shadowUpdateDue(true, 34, 0, false), true);
  assert.equal(shadowUpdateDue(true, 0, 0, true), true);
  assert.equal(shadowUpdateDue(false, 1, 0, false), true);
});
