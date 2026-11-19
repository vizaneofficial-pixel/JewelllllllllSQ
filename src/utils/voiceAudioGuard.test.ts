import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CATEGORIES, INITIAL_STALL_STOCK } from '../data/defaults';
import { buildVoiceCoachSystemInstruction } from '../server/stallTools';
import type { AccountAiContext, PlannerSnapshot } from '../types/stall';
import { applyAiToolAction } from './aiActions';
import {
  VoicePlaybackRegistry,
  VoiceTurnGate,
  shouldSuppressMicFrame,
} from './voiceAudioGuard';

const SAMPLE_SNAPSHOT: PlannerSnapshot = {
  eventName: 'Grand Casa, Siliguri',
  expectedFootfall: 10000,
  budgetCap: 3000,
  minProfitFloor: 3100,
  stallFee: 9000,
  maxPerCategory: 6,
  minColoursRule: 1,
  globalSellThrough: 90,
  rules: {
    allAtLeastOne: true,
    evenDistribution: true,
    beautyFirst: false,
    maxProfitFocus: false,
    safe90Mode: false,
  },
  categories: INITIAL_CATEGORIES,
  selectedComboId: null,
  customQuantities: null,
  stallStock: INITIAL_STALL_STOCK,
  activeTab: 'optimizer',
};

test('VoicePlaybackRegistry stops and disconnects all scheduled buffers cleanly', () => {
  const registry = new VoicePlaybackRegistry();
  let stops = 0;
  let disconnects = 0;

  const s1 = { stop: () => { stops += 1; }, disconnect: () => { disconnects += 1; } };
  const s2 = { stop: () => { stops += 1; }, disconnect: () => { disconnects += 1; } };
  registry.registerSource(s1);
  registry.registerSource(s2);
  registry.nextStartTime = 14.5;

  assert.equal(registry.activeCount, 2);
  const stoppedCount = registry.stopAll(12.25);

  assert.equal(stoppedCount, 2);
  assert.equal(stops, 2);
  assert.equal(disconnects, 2);
  assert.equal(registry.activeCount, 0);
  assert.equal(registry.nextStartTime, 12.25);
});

test('VoiceTurnGate prevents stale connections and superseded turns from playing audio', () => {
  const gate = new VoiceTurnGate();
  const c1 = gate.nextConnection();
  const t1 = gate.nextTurn();
  assert.equal(gate.isCurrentConnection(c1), true);
  assert.equal(gate.isCurrentTurn(t1), true);

  const t2 = gate.nextTurn();
  assert.equal(gate.isCurrentTurn(t1), false);
  assert.equal(gate.isCurrentTurn(t2), true);

  const c2 = gate.nextConnection();
  assert.equal(gate.isCurrentConnection(c1), false);
  assert.equal(gate.isCurrentConnection(c2), true);
});

test('shouldSuppressMicFrame blocks acoustic echo while coach is speaking when Echo Shield is enabled', () => {
  assert.equal(
    shouldSuppressMicFrame({
      echoShieldEnabled: true,
      activeSourceCount: 1,
      outputCurrentTime: 10,
      nextStartTime: 10.5,
    }),
    true
  );

  // Within 240ms speaker reverb tail window
  assert.equal(
    shouldSuppressMicFrame({
      echoShieldEnabled: true,
      activeSourceCount: 0,
      outputCurrentTime: 10.1,
      nextStartTime: 10.0,
    }),
    true
  );

  // Past reverb tail window
  assert.equal(
    shouldSuppressMicFrame({
      echoShieldEnabled: true,
      activeSourceCount: 0,
      outputCurrentTime: 10.4,
      nextStartTime: 10.0,
    }),
    false
  );

  // Echo Shield OFF allows headphone full-duplex
  assert.equal(
    shouldSuppressMicFrame({
      echoShieldEnabled: false,
      activeSourceCount: 2,
      outputCurrentTime: 10.0,
      nextStartTime: 11.0,
    }),
    false
  );
});

test('save_ai_memory and buildVoiceCoachSystemInstruction carry user-scoped AI memories', () => {
  const account: AccountAiContext = {
    displayName: 'Ananya Sen',
    businessName: 'Arohi Jewels',
    preferredScale: 'Exhibition Stall',
    memories: [{ category: 'pricing', fact: 'Always price bridal kundan at 3x wholesale cost' }],
  };

  const exec = applyAiToolAction(
    SAMPLE_SNAPSHOT,
    'save_ai_memory',
    {
      memories: [
        { fact: 'Prefer even 6-category spreads for weekend expos', category: 'preference' },
        { fact: 'x', category: 'invalid_cat' }, // below min length 2 -> dropped
      ],
    },
    account
  );

  assert.equal(exec.memoryAdditions.length, 1);
  assert.equal(exec.memoryAdditions[0].category, 'preference');
  assert.equal(exec.memoryAdditions[0].fact, 'Prefer even 6-category spreads for weekend expos');

  const prompt = buildVoiceCoachSystemInstruction(SAMPLE_SNAPSHOT, account);
  assert.match(prompt, /Ananya Sen/);
  assert.match(prompt, /Arohi Jewels/);
  assert.match(prompt, /Always price bridal kundan at 3x wholesale cost/);
});
