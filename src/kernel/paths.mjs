/**
 * 路径约定与路径比较。
 * ~/.helloagents/ 是唯一的用户级目录：app/ 存放稳定运行副本，
 * install.json 记录安装状态，config.json 存放用户配置。
 */
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const IS_WINDOWS = process.platform === 'win32'

/**
 * 用户主目录。环境变量 HELLOAGENTS_HOME 用于测试隔离与自定义位置。
 * @returns {string}
 */
export function userHome() {
  const override = String(process.env.HELLOAGENTS_HOME || '').trim()
  return override || homedir()
}

/** @param {string} home */
export function helloagentsRoot(home) {
  return join(home, '.helloagents')
}

/** 稳定运行副本目录：hooks 与载体都指向这里，不受 npx 临时目录影响。 @param {string} home */
export function appDir(home) {
  return join(helloagentsRoot(home), 'app')
}

/** @param {string} home */
export function installStatePath(home) {
  return join(helloagentsRoot(home), 'install.json')
}

/** @param {string} home */
export function userConfigPath(home) {
  return join(helloagentsRoot(home), 'config.json')
}

/** 当前包的根目录（cli.mjs 所在目录）。 @returns {string} */
export function packageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

/**
 * 统一为正斜杠路径。生成到宿主配置里的命令一律使用正斜杠，
 * 避免 Windows 反斜杠在 JSON 与 TOML 字符串中的转义问题。
 * @param {string} path
 */
export function toPosix(path) {
  return String(path).replaceAll('\\', '/')
}

/**
 * 判断两个路径是否指向同一位置：两侧都做真实路径解析，
 * Windows 下忽略大小写差异。
 * @param {string} a
 * @param {string} b
 */
export function samePath(a, b) {
  /** @param {string} path */
  const canonical = (path) => {
    let value = path
    try {
      value = realpathSync(path)
    } catch {
      // 路径不存在时按字面值比较。
    }
    value = toPosix(value)
    return IS_WINDOWS ? value.toLowerCase() : value
  }
  return canonical(a) === canonical(b)
}
