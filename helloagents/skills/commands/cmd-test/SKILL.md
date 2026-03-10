---
name: cmd-test
description: >
  Test execution command (~test). Detects test framework,
  runs tests, analyzes failures, suggests fixes.
provides: [test-execution]
category: command
trigger:
  auto: false
requires: [memory]
user-invocable: true
argument-hint: "[test pattern or file]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~test 测试命令

## Execution Flow
```yaml
1. Detect test framework (package.json scripts, pytest, etc.)
2. Determine scope:
   - Specific file/pattern → targeted tests
   - No scope → run all tests
3. Execute tests
4. Analyze results:
   - All pass → report summary
   - Failures → analyze error, suggest fix
   - If fix is clear → offer to create fix package
5. Output: test results + failure analysis
```

## Constraints
DO: Detect framework automatically. Analyze failures with context.
DO NOT: Run tests in watch mode. Modify code without confirmation.
