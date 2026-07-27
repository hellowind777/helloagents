#!/usr/bin/env node
/**
 * HelloAGENTS 命令行入口。
 */
import { runCli } from './src/cli/main.mjs'

process.exitCode = runCli(process.argv.slice(2))
