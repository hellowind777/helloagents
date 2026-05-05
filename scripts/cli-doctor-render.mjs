export function printDoctorText(runtime, report) {
  console.log(`\nHelloAGENTS doctor\n`)
  console.log(runtime.msg(
    `配置:\n  package_version: ${report.config.packageVersion}\n  install_mode: ${report.config.installMode}\n  tracked_host_modes: ${JSON.stringify(report.config.trackedHostModes)}`,
    `Config:\n  package_version: ${report.config.packageVersion}\n  install_mode: ${report.config.installMode}\n  tracked_host_modes: ${JSON.stringify(report.config.trackedHostModes)}`,
  ))
  console.log(runtime.msg(
    `  runtime_root: ${report.config.runtimeRoot}`,
    `  runtime_root: ${report.config.runtimeRoot}`,
  ))

  for (const entry of report.hosts) {
    console.log(`\n${entry.label}:`)
    console.log(`  status: ${entry.status}`)
    console.log(`  detected_mode: ${entry.detectedMode}`)
    console.log(`  tracked_mode: ${entry.trackedMode}`)
    for (const [key, value] of Object.entries(entry.checks)) {
      console.log(`  ${key}: ${value ? 'ok' : 'missing'}`)
    }
    for (const note of entry.notes) {
      console.log(`  note: ${note}`)
    }
    for (const issue of entry.issues) {
      console.log(`  issue[${issue.code}]: ${issue.message}`)
    }
    if (entry.suggestedFix) {
      console.log(`  fix: ${entry.suggestedFix}`)
    }
  }

  console.log(`\nSummary: ok=${report.summary.ok} drift=${report.summary.drift} manual-plugin=${report.summary['manual-plugin']} not-installed=${report.summary['not-installed']} issues=${report.summary.issueCount}\n`)
}
