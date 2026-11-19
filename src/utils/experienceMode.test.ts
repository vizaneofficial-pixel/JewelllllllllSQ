import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExperienceMode } from './experienceMode';

test('routes portrait mobile phone viewports to mobile experience', () => {
  assert.equal(resolveExperienceMode({ width: 360, height: 800 }), 'mobile');
  assert.equal(resolveExperienceMode({ width: 390, height: 844 }), 'mobile');
  assert.equal(resolveExperienceMode({ width: 412, height: 915 }), 'mobile');
  assert.equal(resolveExperienceMode({ width: 430, height: 932 }), 'mobile');
});

test('routes landscape mobile phone viewports to mobile experience', () => {
  assert.equal(resolveExperienceMode({ width: 800, height: 360 }), 'mobile');
  assert.equal(resolveExperienceMode({ width: 844, height: 390 }), 'mobile');
  assert.equal(resolveExperienceMode({ width: 915, height: 412 }), 'mobile');
  assert.equal(resolveExperienceMode({ width: 932, height: 430 }), 'mobile');
});

test('keeps tablets on desktop experience so they never get oversized phone UI', () => {
  assert.equal(resolveExperienceMode({ width: 768, height: 1024 }), 'desktop');
  assert.equal(resolveExperienceMode({ width: 820, height: 1180 }), 'desktop');
  assert.equal(resolveExperienceMode({ width: 1024, height: 768 }), 'desktop');
  assert.equal(resolveExperienceMode({ width: 1180, height: 820 }), 'desktop');
});

test('routes laptops and desktops to desktop experience', () => {
  assert.equal(resolveExperienceMode({ width: 1280, height: 800 }), 'desktop');
  assert.equal(resolveExperienceMode({ width: 1440, height: 900 }), 'desktop');
  assert.equal(resolveExperienceMode({ width: 1920, height: 1080 }), 'desktop');
});
