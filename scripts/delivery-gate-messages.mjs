export function buildUnderSpecifiedDetails(entry) {
  return entry.taskSummary.underSpecifiedItems
    .slice(0, 3)
    .map((item) => {
      const missing = []
      if (item.files.length === 0) missing.push('缺少涉及文件')
      if (!item.acceptance) missing.push('缺少完成标准')
      if (!item.validation) missing.push('缺少验证方式')
      return `${item.text}（${missing.join('、')}）`
    })
}

function issueHeading(issue) {
  switch (issue.type) {
    case 'missing-files':
      return '方案包缺少必需文件'
    case 'template-placeholders':
      return '方案包仍包含模板占位内容'
    case 'missing-task-checklist':
      return '方案包没有可执行任务'
    case 'unfinished-tasks':
      return '方案包仍有未完成任务'
    case 'under-specified-tasks':
      return '任务缺少可交付元数据'
    case 'missing-contract':
      return '方案包缺少可信的结构化契约'
    case 'missing-verify-evidence':
      return '当前工作流缺少最新验证证据'
    case 'missing-review-evidence':
      return '当前工作流缺少最新审查证据'
    case 'missing-advisor-evidence':
      return '当前工作流缺少最新 advisor 证据'
    case 'missing-visual-evidence':
      return '当前工作流缺少最新视觉验收证据'
    case 'missing-closeout-evidence':
      return '当前工作流缺少最新收尾证据'
    default:
      return '方案包尚未达到交付条件'
  }
}

export function buildDeliveryBlockReason(issues, recommendation, gateHint) {
  const lines = ['[Delivery Gate] 当前工作流尚未闭合，暂不能交付：']

  for (const issue of issues) {
    lines.push(`- ${issue.planName}: ${issueHeading(issue)}`)
    for (const detail of issue.details) {
      lines.push(`  - ${detail}`)
    }
    if (issue.extraCount) {
      lines.push(`  - 另有 ${issue.extraCount} 项`)
    }
  }

  lines.push('')
  if (recommendation?.nextPath) {
    lines.push(`处理路径：${recommendation.nextPath}`)
  }
  if (issues.some((issue) => issue.type === 'missing-closeout-evidence')) {
    lines.push('收尾动作：先写入当前会话 `artifacts/closeout.json`，记录 `requirementsCoverage` 和 `deliveryChecklist`，再报告完成。')
  }
  if (issues.some((issue) => issue.type === 'missing-visual-evidence')) {
    lines.push('视觉验收动作：先写入当前会话 `artifacts/visual.json`，记录 `tooling`、`screensChecked`、`statesChecked`、`status` 和 `summary`，再报告完成。')
  }
  if (gateHint) {
    lines.push(gateHint)
  }
  lines.push('暂不要报告完成。先完成剩余任务、补齐收尾证据，或修复方案包，使其成为可信的交付记录。')
  return lines.join('\n')
}
