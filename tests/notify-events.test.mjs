import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveNotifyHost,
  shouldIgnoreCodexNotifyClient,
} from '../scripts/notify-events.mjs';

test('notify events keep only structural filters', () => {
  assert.equal(shouldIgnoreCodexNotifyClient('codex'), false);
  assert.equal(shouldIgnoreCodexNotifyClient('codex-tui'), false);
  assert.equal(shouldIgnoreCodexNotifyClient('codex_exec'), false);
  assert.equal(shouldIgnoreCodexNotifyClient('codex app'), false);
  assert.equal(shouldIgnoreCodexNotifyClient('other-client'), true);
  assert.equal(resolveNotifyHost(['node', 'notify.mjs', 'codex-notify']), 'codex');
  assert.equal(resolveNotifyHost(['node', 'notify.mjs', 'stop', '--codex']), 'codex');
  assert.equal(resolveNotifyHost(['node', 'notify.mjs', 'stop', '--gemini']), 'gemini');
  assert.equal(resolveNotifyHost(['node', 'notify.mjs', 'stop']), 'claude');
});
