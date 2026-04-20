import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldIgnoreCodexNotifyClient, shouldIgnoreFormattedSubagent } from '../scripts/notify-events.mjs';

test('notify events keep only structural filters', () => {
  assert.equal(shouldIgnoreCodexNotifyClient('codex-tui'), false);
  assert.equal(shouldIgnoreCodexNotifyClient('other-client'), true);
  assert.equal(shouldIgnoreFormattedSubagent('子代理完成', true), true);
  assert.equal(shouldIgnoreFormattedSubagent('✅【HelloAGENTS】- 当前任务已完成', true), false);
});
