import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ruleIntent } from '../shared/intentRules';
import type { IntentContext } from '../shared/types';

const chem: IntentContext = {
  subject: 'Organic chemistry',
  topics: ['Functional groups', 'SN2 reactions', 'Stereochemistry', 'Alkenes'],
  open: ['Organic chemistry', 'Projectile motion'],
  saved: ['Multivariable calculus › Chain rule', 'World War II'],
  folders: ['Chemistry'],
};
const act = (t: string, ctx: IntentContext = chem) => ruleIntent(t, ctx).intent;

test('a related topic narrows the current lesson; an unrelated one starts a new lesson', () => {
  assert.deepEqual(act("let's dive into SN2 reactions"), { action: 'focus', topic: 'sn2 reactions' });
  assert.deepEqual(act('teach me about stereochemistry'), { action: 'focus', topic: 'stereochemistry' });
  assert.deepEqual(act("ok now let's learn about photosynthesis instead"), { action: 'newLesson', subject: 'photosynthesis' });
  assert.deepEqual(act('switch to the french revolution'), { action: 'newLesson', subject: 'french revolution' });
  assert.deepEqual(act('tell me about black holes', {}), { action: 'newLesson', subject: 'black holes' }); // no lesson yet
});

test('saving, folders, library and reopening lessons by name', () => {
  assert.deepEqual(act('save this lesson'), { action: 'save', folder: undefined });
  assert.deepEqual(act('save this to my chemistry folder'), { action: 'save', folder: 'chemistry' });
  assert.deepEqual(act('open my library'), { action: 'library' });
  assert.deepEqual(act('open the chain rule lesson'), { action: 'open', title: 'Multivariable calculus › Chain rule' });
  assert.deepEqual(act('go back to projectile motion'), { action: 'open', title: 'Projectile motion' });
});

test('sections, models and problems', () => {
  assert.deepEqual(act('go to history'), { action: 'goto', section: 'timeline' });
  assert.deepEqual(act('show me the model of benzene'), { action: 'model', request: 'benzene' });
  assert.deepEqual(act('graph x squared minus y squared'), { action: 'model', request: 'x squared minus y squared' });
  assert.deepEqual(act('show me another one'), { action: 'newExample' });
  assert.deepEqual(act('previous model'), { action: 'modelStep', step: -1 });
  assert.deepEqual(act('how do I solve 2x plus 3 equals 7'), { action: 'solve', question: '2x plus 3 equals 7' });
  assert.deepEqual(act('back to the whole subject'), { action: 'widen' });
  assert.deepEqual(act('go home'), { action: 'home' });
});

test('chit-chat does nothing, and every result has something to say', () => {
  const r = ruleIntent('the weather is nice today', chem);
  assert.equal(r.intent.action, 'none');
  assert.ok(r.say.length > 0);
});

test('sandbox: add, move, react with a condition, remove', () => {
  const box: IntentContext = { ...chem, sandbox: ['Methane'] };
  assert.deepEqual(act('add two oxygens', box), { action: 'sandboxAdd', name: 'oxygen', count: 2 });
  assert.deepEqual(act('add methane to the sandbox', {}), { action: 'sandboxAdd', name: 'methane', count: 1 });
  assert.deepEqual(act('move the methane to the left', box), { action: 'sandboxMove', target: 'the methane', direction: 'left' });
  assert.deepEqual(act('push them together', box), { action: 'sandboxMove', target: 'them', direction: 'together' });
  assert.deepEqual(act('react them with heat', box), { action: 'sandboxReact', condition: 'heat' });
  assert.deepEqual(act('now ignite it', box), { action: 'sandboxReact', condition: 'heat' });
  assert.deepEqual(act('remove the water', box), { action: 'sandboxRemove', target: 'the water' });
  assert.deepEqual(act('open the sandbox'), { action: 'sandbox' });
});
