import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCodexCloseoutSnapshot,
  matchesCodexCloseoutEvidence,
} from '../scripts/notify-closeout.mjs'

test('closeout evidence matches later event without turn id by session message fallback', () => {
  const completeState = {
    key: 'D:/repo::beta::12345678',
    updatedAt: '2026-05-06T07:00:00.000Z',
  }
  const evidenceSnapshot = buildCodexCloseoutSnapshot({
    payload: {
      sessionId: '12345678',
      turnId: 'turn-1',
      lastAssistantMessage: '任务已完成。',
    },
    turnState: completeState,
  })

  const duplicateSnapshot = buildCodexCloseoutSnapshot({
    payload: {
      sessionId: '12345678',
      lastAssistantMessage: '任务已完成。',
    },
    turnState: null,
  })

  assert.equal(matchesCodexCloseoutEvidence({
    updatedAt: '2026-05-06T07:00:05.000Z',
    strongKeys: evidenceSnapshot.strongKeys,
    weakKeys: evidenceSnapshot.weakKeys,
  }, duplicateSnapshot, Date.parse('2026-05-06T07:00:06.000Z')), true)
})

test('weak message fallback does not suppress a new strong turn with the same text', () => {
  const previousSnapshot = buildCodexCloseoutSnapshot({
    payload: {
      sessionId: '12345678',
      turnId: 'turn-1',
      lastAssistantMessage: '任务已完成。',
    },
    turnState: {
      key: 'D:/repo::beta::12345678',
      updatedAt: '2026-05-06T07:00:00.000Z',
    },
  })
  const nextSnapshot = buildCodexCloseoutSnapshot({
    payload: {
      sessionId: '12345678',
      turnId: 'turn-2',
      lastAssistantMessage: '任务已完成。',
    },
    turnState: {
      key: 'D:/repo::beta::12345678',
      updatedAt: '2026-05-06T07:01:00.000Z',
    },
  })

  assert.equal(matchesCodexCloseoutEvidence({
    updatedAt: '2026-05-06T07:00:05.000Z',
    strongKeys: previousSnapshot.strongKeys,
    weakKeys: previousSnapshot.weakKeys,
  }, nextSnapshot, Date.parse('2026-05-06T07:00:06.000Z')), false)
})
