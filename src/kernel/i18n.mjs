/**
 * 语言检测与文案取用。
 * 优先级：HELLOAGENTS_LANG 显式指定 > 系统区域设置包含中文 > 英文。
 */
import { MESSAGES } from './messages.mjs'

/** @typedef {'cn' | 'en'} Language */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Language}
 */
export function detectLanguage(env = process.env) {
  const forced = String(env.HELLOAGENTS_LANG || '')
    .trim()
    .toLowerCase()
  if (forced === 'cn' || forced === 'zh' || forced.startsWith('zh-')) return 'cn'
  if (forced === 'en' || forced.startsWith('en-')) return 'en'
  const locale = `${env.LANG || ''} ${env.LC_ALL || ''} ${env.LANGUAGE || ''}`.toLowerCase()
  return locale.includes('zh') || locale.includes('cn') ? 'cn' : 'en'
}

/**
 * 创建翻译函数。文案缺失时回退为键名，保证永远有输出。
 * @param {Language} language
 * @returns {(key: string, vars?: Record<string, string | number>) => string}
 */
export function createTranslator(language) {
  return (key, vars = {}) => {
    const entry = MESSAGES[key]
    let text = entry ? entry[language] : key
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }
}
