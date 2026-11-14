import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Command } from '../src/core/commands';
import { createVoiceSession, parseVoiceCommand } from '../src/core/input/voice';

test('navigation phrases', () => {
  assert.deepEqual(parseVoiceCommand('Go to history'), [{ type: 'goto', section: 'timeline' }]);
  assert.deepEqual(parseVoiceCommand('open the topic map'), [{ type: 'goto', section: 'topics' }]);
  assert.deepEqual(parseVoiceCommand('show me the problems.'), [{ type: 'goto', section: 'problems' }]);
  assert.deepEqual(parseVoiceCommand('show the model'), [{ type: 'goto', section: 'visual' }]);
  assert.deepEqual(parseVoiceCommand('go home'), [{ type: 'home' }]);
});

test('content requests', () => {
  assert.deepEqual(parseVoiceCommand('Show me benzene'), [{ type: 'generate', request: 'benzene' }]);
  assert.deepEqual(parseVoiceCommand('graph x squared minus y squared'), [{ type: 'generate', request: 'x squared minus y squared' }]);
  assert.deepEqual(parseVoiceCommand('another example'), [{ type: 'newExample' }]);
  assert.deepEqual(parseVoiceCommand('solve two x plus three equals seven'), [{ type: 'solve', question: 'two x plus three equals seven' }]);
});

test('camera phrases still work', () => {
  assert.deepEqual(parseVoiceCommand('zoom in'), [{ type: 'zoom', factor: 0.75 }]);
  assert.deepEqual(parseVoiceCommand('top view'), [{ type: 'view', view: 'top' }]);
});

test('section names must end the phrase, and bare names work', () => {
  assert.deepEqual(parseVoiceCommand('history'), [{ type: 'goto', section: 'timeline' }]);
  assert.deepEqual(parseVoiceCommand('Okay, take me to the practice problems please'), [{ type: 'goto', section: 'problems' }]);
  assert.deepEqual(parseVoiceCommand('switch to the timeline tab'), [{ type: 'goto', section: 'timeline' }]);
  assert.deepEqual(parseVoiceCommand('can you pull up my notes?'), [{ type: 'goto', section: 'topics' }]);
  assert.deepEqual(parseVoiceCommand('back to the 3D model'), [{ type: 'goto', section: 'visual' }]);
  assert.deepEqual(parseVoiceCommand('show me the model of benzene'), [{ type: 'generate', request: 'benzene' }]);
  assert.deepEqual(parseVoiceCommand('show me the history of the atom'), [{ type: 'generate', request: 'history of the atom' }]);
});

test('next, previous and home', () => {
  assert.deepEqual(parseVoiceCommand('next section'), [{ type: 'next' }]);
  assert.deepEqual(parseVoiceCommand('go to the previous tab'), [{ type: 'prev' }]);
  assert.deepEqual(parseVoiceCommand('go back'), [{ type: 'prev' }]);
  assert.deepEqual(parseVoiceCommand('take me home'), [{ type: 'home' }]);
  assert.deepEqual(parseVoiceCommand('start over'), [{ type: 'home' }]);
  assert.deepEqual(parseVoiceCommand('solve my homework problem'), [{ type: 'solve', question: 'my homework problem' }]);
});

test('forgiving content phrases', () => {
  assert.deepEqual(parseVoiceCommand('Hey, could you draw a water molecule?'), [{ type: 'generate', request: 'water molecule' }]);
  assert.deepEqual(parseVoiceCommand('what does methane look like'), [{ type: 'generate', request: 'methane' }]);
  assert.deepEqual(parseVoiceCommand('I want to see a 3D model of caffeine'), [{ type: 'generate', request: 'caffeine' }]);
  assert.deepEqual(parseVoiceCommand('plot sine of x times cosine of y'), [{ type: 'generate', request: 'sine of x times cosine of y' }]);
  assert.deepEqual(parseVoiceCommand('show me a rotating top'), [{ type: 'generate', request: 'rotating top' }]);
  assert.deepEqual(parseVoiceCommand('how do I solve x squared equals nine'), [{ type: 'solve', question: 'x squared equals nine' }]);
  assert.deepEqual(parseVoiceCommand('help me with this: three x minus one equals eight'), [{ type: 'solve', question: 'three x minus one equals eight' }]);
  assert.deepEqual(parseVoiceCommand('simplify two x plus four x'), [{ type: 'solve', question: 'simplify two x plus four x' }]);
  for (const p of ['show me another one', 'try another', 'something else please', 'give me a different example', 'change the model', 'next example'])
    assert.deepEqual(parseVoiceCommand(p), [{ type: 'newExample' }], p);
});

test('camera fallbacks and nonsense', () => {
  assert.deepEqual(parseVoiceCommand('make it bigger'), [{ type: 'zoom', factor: 0.75 }]);
  assert.deepEqual(parseVoiceCommand('spin it to the left'), [{ type: 'rotate', dx: -0.5, dy: 0 }]);
  assert.deepEqual(parseVoiceCommand('reset'), [{ type: 'reset' }]);
  assert.deepEqual(parseVoiceCommand('the weather is nice today'), []);
  assert.deepEqual(parseVoiceCommand(''), []);
});

test('session: quick commands fire once on interim results, content waits for the final result', () => {
  const out: Command[] = [];
  const s = createVoiceSession((c) => out.push(c));
  assert.deepEqual(s.handle(0, 'go', false).actions, []);
  assert.deepEqual(s.handle(0, 'go to history', false).actions, ['Opening history']);
  assert.deepEqual(s.handle(0, 'go to history', true).actions, []); // not twice
  assert.deepEqual(out, [{ type: 'goto', section: 'timeline' }]);

  // Whole sentences go to the assistant (which knows the lesson context) once they are final.
  out.length = 0;
  assert.deepEqual(s.handle(1, 'show me', false).actions, []);
  assert.deepEqual(s.handle(1, 'show me the model', false).actions, []); // could still become "the model of ..."
  assert.deepEqual(s.handle(1, 'show me the model of benzene', false).actions, []);
  assert.deepEqual(s.handle(1, 'Show me the model of benzene.', true).actions, ['Thinking…']);
  assert.deepEqual(out, [{ type: 'ask', text: 'Show me the model of benzene.' }]);

  out.length = 0;
  s.handle(2, "let's switch to photosynthesis", false);
  s.handle(2, "let's switch to photosynthesis instead", true);
  assert.deepEqual(out, [{ type: 'ask', text: "let's switch to photosynthesis instead" }]);

  out.length = 0;
  s.handle(3, 'next model', true);
  assert.deepEqual(out, [{ type: 'modelStep', step: 1 }]);
});

test('session: one-word interims wait, so "next" + "example" is one new example, not a section change', () => {
  const out: Command[] = [];
  const s = createVoiceSession((c) => out.push(c));
  s.handle(0, 'next', false);
  s.handle(0, 'next example', false);
  s.handle(0, 'next example', true);
  assert.deepEqual(out, [{ type: 'newExample' }]);

  out.length = 0;
  s.handle(1, 'zoom in', false);
  s.handle(1, 'zoom in more', false);
  s.handle(1, 'zoom in more', true);
  assert.deepEqual(out, [{ type: 'zoom', factor: 0.75 }]);

  out.length = 0;
  s.handle(2, 'home', false);
  s.handle(2, 'home', true);
  assert.deepEqual(out, [{ type: 'home' }]);
  // a new utterance with the same words fires again
  s.handle(3, 'go home', true);
  assert.equal(out.length, 2);
});

test('sentences that merely contain "next" or "go back" are not section changes', () => {
  assert.deepEqual(parseVoiceCommand('go back to organic chemistry'), []);
  assert.deepEqual(parseVoiceCommand("what's next in the history of physics"), []);
  assert.deepEqual(parseVoiceCommand('go back'), [{ type: 'prev' }]);
});
