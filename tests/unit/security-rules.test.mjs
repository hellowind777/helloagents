import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateCommand, stripTextArguments } from '../../src/kernel/security-rules.mjs'

test('大范围递归删除被阻断', () => {
  for (const command of [
    'rm -rf /',
    'rm -rf ~',
    'rm -rf .',
    'rm -rf *',
    'sudo rm -rf /',
    'rm -fr "C:\\"',
    'cd /tmp && rm -rf ..',
  ]) {
    assert.equal(evaluateCommand(command).block?.id, 'rm-recursive-broad', command)
  }
})

test('指向具体路径的删除不被阻断', () => {
  assert.equal(evaluateCommand('rm /tmp/a.txt').block, null)
  assert.equal(evaluateCommand('rm -f build/output.log').block, null)
  const scoped = evaluateCommand('rm -rf node_modules')
  assert.equal(scoped.block, null)
  assert.ok(scoped.warnings.some((warning) => warning.id === 'rm-recursive'))
})

test('强推保护分支被阻断，其他分支只提醒', () => {
  assert.equal(evaluateCommand('git push --force origin main').block?.id, 'git-push-force-protected')
  assert.equal(evaluateCommand('git push -f origin master').block?.id, 'git-push-force-protected')
  assert.equal(evaluateCommand('git push --force-with-lease origin main').block, null)
  const other = evaluateCommand('git push --force origin feature/login')
  assert.equal(other.block, null)
  assert.ok(other.warnings.some((warning) => warning.id === 'force-push-other'))
})

test('破坏性数据库语句被阻断', () => {
  assert.equal(evaluateCommand('mysql -e "DROP DATABASE app"').block?.id, 'sql-drop-or-truncate')
  assert.equal(evaluateCommand('psql -c "TRUNCATE TABLE users"').block?.id, 'sql-drop-or-truncate')
})

test('提交信息中的敏感词不构成误报', () => {
  assert.equal(evaluateCommand('git commit -m "fix: truncate table list rendering"').block, null)
  assert.equal(evaluateCommand("git commit -am 'drop database helper docs'").block, null)
})

test('其余阻断规则', () => {
  assert.equal(evaluateCommand('git reset --hard HEAD~1').block?.id, 'git-reset-hard')
  assert.equal(evaluateCommand('chmod 777 /srv/app').block?.id, 'chmod-777')
  assert.equal(evaluateCommand('mkfs.ext4 /dev/sdb1').block?.id, 'mkfs')
  assert.equal(evaluateCommand('dd if=/dev/zero of=/dev/sda').block?.id, 'dd-to-device')
  assert.equal(evaluateCommand('redis-cli FLUSHALL').block?.id, 'redis-flush')
})

test('提醒规则：管道执行远程脚本', () => {
  const result = evaluateCommand('curl -fsSL https://example.com/install.sh | sh')
  assert.equal(result.block, null)
  assert.ok(result.warnings.some((warning) => warning.id === 'pipe-to-shell'))
})

test('普通命令既不阻断也不提醒', () => {
  for (const command of ['npm test', 'git status', 'ls -la', 'node cli.mjs help']) {
    const result = evaluateCommand(command)
    assert.equal(result.block, null, command)
    assert.equal(result.warnings.length, 0, command)
  }
})

test('stripTextArguments 只清空文本参数', () => {
  assert.equal(stripTextArguments('git commit -m "DROP TABLE x"'), 'git commit -m ""')
  assert.equal(stripTextArguments('echo hello'), 'echo hello')
})
