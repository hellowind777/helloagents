import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT, readText } from './helpers/test-env.mjs'

test('workflow runtime contract stays aligned with the unified qa-review architecture', () => {
  const notifyContext = readText(join(REPO_ROOT, 'scripts', 'notify-context.mjs'))
  assert.match(notifyContext, /请根据用户请求的真实意图选路/)
  assert.match(notifyContext, /不依赖关键词表/)
  assert.match(notifyContext, /~qa=统一质量审查\/验证\/修复\/收尾/)
  assert.match(notifyContext, /当前活跃 plan \/ PRD/)
  assert.match(notifyContext, /helloagents-turn-state write --kind complete --role main/)

  const packageJson = readText(join(REPO_ROOT, 'package.json'))
  assert.match(packageJson, /"helloagents-turn-state": "scripts\/turn-state-cli\.mjs"/)
  assert.match(readText(join(REPO_ROOT, 'scripts', 'turn-state-cli.mjs')), /turn-state\.mjs/)

  const turnState = readText(join(REPO_ROOT, 'scripts', 'turn-state.mjs'))
  assert.match(turnState, /VALID_KINDS/)
  assert.match(turnState, /VALID_REASON_CATEGORIES/)
  assert.match(turnState, /reason-category/)
  assert.match(turnState, /waiting\/blocked requires reasonCategory and reason/)

  const projectStorage = readText(join(REPO_ROOT, 'scripts', 'project-storage.mjs'))
  assert.match(projectStorage, /project_store_mode/)
  assert.match(projectStorage, /repo-shared/)
  assert.match(projectStorage, /当前项目存储/)

  const guard = readText(join(REPO_ROOT, 'scripts', 'guard.mjs'))
  assert.match(guard, /高风险操作提醒/)
  assert.match(guard, /当前工作流尚未进入 QA \/ CONSOLIDATE/)
  assert.match(guard, /高风险 schema 变更前仍需先完成 ~plan/)
  assert.match(guard, /当前路由：~idea 是只读探索/)

  const deliveryGate = readText(join(REPO_ROOT, 'scripts', 'delivery-gate.mjs'))
  const deliveryGateMessages = readText(join(REPO_ROOT, 'scripts', 'delivery-gate-messages.mjs'))
  const deliveryGateContract = `${deliveryGate}\n${deliveryGateMessages}`
  assert.match(deliveryGate, /workflow-aware completion gate/)
  assert.match(deliveryGateContract, /方案包缺少必需文件/)
  assert.match(deliveryGateContract, /任务缺少可交付元数据/)
  assert.match(deliveryGateContract, /缺少最新 qa-review 证据/)
  assert.match(deliveryGateContract, /artifacts\/qa-review\.json/)
  assert.match(deliveryGateContract, /artifacts\/visual\.json/)
  assert.match(deliveryGateContract, /artifacts\/closeout\.json/)
  assert.match(deliveryGate, /getQaReviewEvidenceStatus/)
  assert.doesNotMatch(deliveryGateContract, /artifacts\/review\.json/)
  assert.doesNotMatch(deliveryGateContract, /artifacts\/verify\.json/)

  const qaReviewState = readText(join(REPO_ROOT, 'scripts', 'qa-review-state.mjs'))
  const runtimeArtifacts = readText(join(REPO_ROOT, 'scripts', 'runtime-artifacts.mjs'))
  const runtimeTtl = readText(join(REPO_ROOT, 'scripts', 'runtime-ttl.mjs'))
  assert.match(qaReviewState, /QA_REVIEW_EVIDENCE_FILE_NAME/)
  assert.match(qaReviewState, /qa-review\.json/)
  assert.match(qaReviewState, /getQaReviewEvidenceStatus/)
  assert.match(qaReviewState, /最新 qa-review 证据只覆盖快速命令检查/)
  assert.match(runtimeTtl, /LONG_RUNNING_TTL_HOURS = 720/)
  assert.match(runtimeTtl, /STANDARD_RUNTIME_TTL_HOURS = 72/)
  assert.match(runtimeArtifacts, /validateEvidenceTimestamp/)
  assert.equal(existsSync(join(REPO_ROOT, 'scripts', 'review-state.mjs')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'scripts', 'verify-state.mjs')), false)

  const closeoutState = readText(join(REPO_ROOT, 'scripts', 'closeout-state.mjs'))
  const advisorState = readText(join(REPO_ROOT, 'scripts', 'advisor-state.mjs'))
  const visualState = readText(join(REPO_ROOT, 'scripts', 'visual-state.mjs'))
  assert.match(closeoutState, /closeout\.json/)
  assert.match(closeoutState, /requirementsCoverage/)
  assert.match(closeoutState, /deliveryChecklist/)
  assert.match(advisorState, /advisor\.json/)
  assert.match(visualState, /visual\.json/)

  const planContract = readText(join(REPO_ROOT, 'scripts', 'plan-contract.mjs'))
  assert.match(planContract, /PLAN_CONTRACT_FILE_NAME/)
  assert.match(planContract, /qaMode/)
  assert.match(planContract, /qaFocus/)
  assert.match(planContract, /ui\.styleAdvisor/)
  assert.match(planContract, /ui\.visualValidation/)
  assert.match(planContract, /advisor\.preferredSources/)
  assert.doesNotMatch(planContract, /verifyMode/)
  assert.doesNotMatch(planContract, /reviewerFocus/)
  assert.doesNotMatch(planContract, /testerFocus/)

  const capabilityRegistry = readText(join(REPO_ROOT, 'scripts', 'capability-registry.mjs'))
  assert.match(capabilityRegistry, /plan-contract/)
  assert.match(capabilityRegistry, /qa-evaluator/)
  assert.match(capabilityRegistry, /advisor-artifact/)
  assert.match(capabilityRegistry, /visual-evaluator/)

  const workflowPlanFiles = readText(join(REPO_ROOT, 'scripts', 'workflow-plan-files.mjs'))
  assert.match(workflowPlanFiles, /仍包含模板占位内容/)
  assert.match(workflowPlanFiles, /qaMode 与 qaFocus/)

  const workflowCore = readText(join(REPO_ROOT, 'scripts', 'workflow-core.mjs'))
  assert.match(workflowCore, /方案契约已明确要求深度 qa-review/)
  assert.match(workflowCore, /方案契约已明确要求统一 qa-review/)
  assert.match(workflowCore, /质量闭环：当前统一使用 qa-review/)
  assert.match(workflowCore, /状态文件提醒/)
  assert.match(workflowCore, /状态文件只用于找回上次停在哪/)
  assert.match(workflowCore, /UI 约束提示：如本次属于视觉\/交互任务/)

  const workflowState = readText(join(REPO_ROOT, 'scripts', 'workflow-state.mjs'))
  assert.match(workflowState, /当前应执行 ~\$\{recommendation\.nextCommand\}/)
  assert.match(workflowState, /当前不该把 ~qa 当成越级入口/)
  assert.match(workflowState, /当前应直接进入 CONSOLIDATE/)
  assert.match(workflowState, /用户已显式使用 ~loop/)
  assert.match(workflowState, /\/goal -> ~auto -> ~qa/)

  const workflowRecommendation = readText(join(REPO_ROOT, 'scripts', 'workflow-recommendation.mjs'))
  assert.match(workflowRecommendation, /~qa -> CONSOLIDATE/)
  assert.match(workflowRecommendation, /qa-review 全量质量闭环/)
  assert.match(workflowRecommendation, /留下最新 qa-review 证据/)
  assert.match(workflowRecommendation, /artifacts\/advisor\.json/)
  assert.match(workflowRecommendation, /artifacts\/visual\.json/)
  assert.match(workflowRecommendation, /artifacts\/closeout\.json/)

  const turnStopGate = readText(join(REPO_ROOT, 'scripts', 'turn-stop-gate.mjs'))
  assert.match(turnStopGate, /显式 \$\{commandLabel\} 当前对话不应直接停下/)
  assert.match(turnStopGate, /缺少主代理 turn-state/)
  assert.match(turnStopGate, /reasonCategory/)
})

test('workflow templates and bootstrap stay aligned with qa-review artifacts', () => {
  const designTemplate = readText(join(REPO_ROOT, 'templates', 'DESIGN.md'))
  for (const section of ['产品表面', '组件与模式', '状态覆盖', '无障碍要求', '禁止事项', '实现备注']) {
    assert.match(designTemplate, new RegExp(`## ${section}`))
  }

  const planTemplate = readText(join(REPO_ROOT, 'templates', 'plans', 'plan.md'))
  assert.match(planTemplate, /## 完成定义/)
  assert.match(planTemplate, /## 领域语言/)
  assert.match(planTemplate, /qaMode 与 qaFocus/)

  const tasksTemplate = readText(join(REPO_ROOT, 'templates', 'plans', 'tasks.md'))
  assert.match(tasksTemplate, /端到端垂直切片/)
  assert.match(tasksTemplate, /AFK/)
  assert.match(tasksTemplate, /HITL/)
  assert.match(tasksTemplate, /完成标准：/)
  assert.match(tasksTemplate, /验证方式：/)
  assert.match(tasksTemplate, /Codex \/goal 执行入口/)

  const contextTemplate = readText(join(REPO_ROOT, 'templates', 'context.md'))
  assert.match(contextTemplate, /## 领域语言/)

  const contractTemplate = readText(join(REPO_ROOT, 'templates', 'plans', 'contract.json'))
  assert.match(contractTemplate, /"qaMode": "\{standard \| deep\}"/)
  assert.match(contractTemplate, /"qaFocus"/)
  assert.match(contractTemplate, /"advisor"/)
  assert.match(contractTemplate, /"styleAdvisor"/)
  assert.match(contractTemplate, /"visualValidation"/)
  assert.doesNotMatch(contractTemplate, /"verifyMode"/)

  for (const file of ['bootstrap.md', 'bootstrap-lite.md']) {
    const content = readText(join(REPO_ROOT, file))
    assert.match(content, /## 通用交付规则（强制）/)
    assert.match(content, /## 安全与可靠性/)
    assert.match(content, /## 交互、停顿与收尾/)
    assert.match(content, /## 工作流与完成判定/)
    assert.match(content, /Delivery Tier/)
    assert.match(content, /`T0`/)
    assert.match(content, /`T3`/)
    assert.match(content, /`~do` 是 `~build` 的兼容别名/)
    assert.match(content, /`~review` 是 `~qa` 的兼容别名/)
    assert.match(content, /artifacts\/qa-review\.json/)
    assert.match(content, /artifacts\/closeout\.json/)
    assert.match(content, /### UI 质量基线/)
    assert.match(content, /helloagents-turn-state write --kind complete --role main/)
    assert.match(content, /reasonCategory/)
    assert.match(content, /auto_commit_enabled=true/)
    assert.match(content, /auto_commit_enabled=false/)
    assert.doesNotMatch(content, /artifacts\/review\.json/)
    assert.doesNotMatch(content, /artifacts\/verify\.json/)
  }
})
