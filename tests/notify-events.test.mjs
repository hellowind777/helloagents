import test from 'node:test';
import assert from 'node:assert/strict';

import { claimsTaskComplete } from '../scripts/notify-events.mjs';

test('claimsTaskComplete avoids treating confirmation summaries as completed delivery', () => {
  assert.equal(claimsTaskComplete('✅【HelloAGENTS】- 方案已确认'), false);
  assert.equal(claimsTaskComplete('❓【HelloAGENTS】- 等待输入'), false);
  assert.equal(claimsTaskComplete('✅【HelloAGENTS】- 当前任务已完成'), true);
  assert.equal(claimsTaskComplete('当前任务已完成，等待您的下一步指示。'), true);
});
