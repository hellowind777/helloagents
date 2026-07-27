/**
 * 载体文件操作：把内核写入宿主或项目的规则文件，或从中移除。
 * 写入内容始终包裹在标记对里，标记外的用户内容不受影响。
 */
import { join } from 'node:path'
import { readText } from '../kernel/fsx.mjs'
import {
  buildMarkedBlock,
  hasMarkedBlock,
  readMarkedVersion,
  removeMarkedBlock,
  upsertMarkedBlock,
} from '../kernel/ownership.mjs'

/**
 * 读取运行副本中的内核文本。
 * @param {string} appDirPath
 * @returns {string | null}
 */
export function readKernelText(appDirPath) {
  return readText(join(appDirPath, 'prompts', 'kernel.md'))
}

/**
 * 写入内核到载体文件。
 * @param {string} carrierFile
 * @param {string} kernelText
 * @param {string} version
 */
export function injectKernel(carrierFile, kernelText, version) {
  return upsertMarkedBlock(carrierFile, buildMarkedBlock(kernelText, version))
}

/**
 * 从载体文件移除内核。
 * @param {string} carrierFile
 */
export function removeKernel(carrierFile) {
  return removeMarkedBlock(carrierFile)
}

/**
 * 载体状态：ok（版本一致）、outdated（版本不一致或缺版本注释）、missing（无受管内容）。
 * @param {string} carrierFile
 * @param {string} expectedVersion
 * @returns {'ok' | 'outdated' | 'missing'}
 */
export function carrierStatus(carrierFile, expectedVersion) {
  if (!hasMarkedBlock(carrierFile)) return 'missing'
  const version = readMarkedVersion(carrierFile)
  return version === expectedVersion ? 'ok' : 'outdated'
}
