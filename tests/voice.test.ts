import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../src/core/input/voice';

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
