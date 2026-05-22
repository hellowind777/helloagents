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
    if (entry.nativeDoctor) {
      console.log(`  native_doctor.available: ${entry.nativeDoctor.available ? 'ok' : 'missing'}`)
      if (entry.nativeDoctor.available) {
        console.log(`  native_doctor.ok: ${entry.nativeDoctor.ok ? 'ok' : 'fail'}`)
        if (entry.nativeDoctor.status) console.log(`  native_doctor.status: ${entry.nativeDoctor.status}`)
      }
      if (entry.nativeDoctor.summary) {
        if (entry.nativeDoctor.summary.version) console.log(`  native_doctor.version: ${entry.nativeDoctor.summary.version}`)
        if (entry.nativeDoctor.summary.configPath) console.log(`  native_doctor.config_path: ${entry.nativeDoctor.summary.configPath}`)
        if (entry.nativeDoctor.summary.resolvedProvider) console.log(`  native_doctor.resolved_provider: ${entry.nativeDoctor.summary.resolvedProvider}`)
        if (entry.nativeDoctor.summary.resolvedModel) console.log(`  native_doctor.resolved_model: ${entry.nativeDoctor.summary.resolvedModel}`)
        if (entry.nativeDoctor.summary.sandboxAvailable !== null) console.log(`  native_doctor.sandbox_available: ${entry.nativeDoctor.summary.sandboxAvailable}`)
        console.log(`  native_doctor.mcp_present: ${entry.nativeDoctor.summary.mcpPresent ? 'ok' : 'missing'}`)
        console.log(`  native_doctor.skills_selected: ${entry.nativeDoctor.summary.skillsSelected.join(', ') || '(none)'}`)
      }
      if (entry.nativeDoctor.output) console.log(`  native_doctor.output: ${entry.nativeDoctor.output}`)
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
