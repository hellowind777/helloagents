import test from 'node:test'
import assert from 'node:assert/strict'

import { buildHomeEnv, createHomeFixture, createPackageFixture, runNode } from './helpers/test-env.mjs'

test('help renders successfully with and without an explicit help command', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)

  for (const args of [[], ['help']]) {
    const result = runNode(`${pkgRoot}/cli.mjs`, args, {
      cwd: pkgRoot,
      env,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /HelloAGENTS v/)
    assert.match(result.stdout, /cursor/i)
    assert.match(result.stdout, /grok/i)
    assert.doesNotMatch(result.stderr || '', /ReferenceError/)
  }
})
