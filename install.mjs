#!/usr/bin/env node
/**
 * DSH Prompt Enhancer — 一键安装器（零依赖，Node ≥ 18）
 *
 * 用法：
 *   node install.mjs [dshCheckoutPath] [--skip-build] [--with-web]
 *
 * 资源策略（自动）：
 *   1. 本地模式：install.mjs 同目录存在 patch / plugin 时直接使用（git clone 后）。
 *   2. 远程模式：本地资源缺失时，自动从 GitHub 下载仓库压缩包并解压取资源
 *      （支持 `curl ... install.sh | bash` 管道安装）。
 *
 * 自动完成：
 *   1. 定位 DSH 源码 checkout（参数 / 环境变量 DSH_CHECKOUT / 当前目录）
 *   2. 检测并应用 apiproxy 补丁（session.enhancePrompt RPC，幂等）
 *   3. 放置插件包到 packages/client/ui-prompt-enhancer（幂等）
 *   4. 复核组合接线（cordis.patch.yml / web-app / tsconfig）
 *   5. pnpm install + 构建（lib），可选 build:web
 *   6. 提示重启 dsh
 *
 * 已应用 / 已含 RPC 时自动跳过对应步骤，可重复执行。
 */
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REMOTE_REPO = 'spiceemilissa502-max/dsh-prompt-enhancer'
const REMOTE_BRANCH = 'main'
const TARBALL_URL = `https://codeload.github.com/${REMOTE_REPO}/tar.gz/refs/heads/${REMOTE_BRANCH}`
const PLUGIN_NAME = '@deepseek-ai/dsh-client-ui-prompt-enhancer'
const RPC_MARK = "session.enhancePrompt': SessionsApi['enhancePrompt'"

let PATCH = join(HERE, 'patch-0001-prompt-enhancer.patch')
let PLUGIN_SRC = join(HERE, 'plugin', 'ui-prompt-enhancer')
let REMOTE_DIR = null

function dirname(url) { return url.replace(/[\\/][^\\/]*$/, '') }

/** 读取 tar 头部中的 NUL 结尾、去空白字段。 */
function cString(buffer, start, end) {
  const slice = buffer.subarray(start, end)
  const nul = slice.indexOf(0)
  const text = slice.subarray(0, nul === -1 ? undefined : nul).toString('utf8').trim()
  return text.replace(/\0+$/, '')
}

/**
 * 纯 JS 解压 .tar.gz（支持 GNU 长名与目录条目），不依赖外部 tar 命令，
 * 保证在 Windows / Linux / macOS 与受限环境下均可运行。
 * @param buffer - gzip 压缩的 tar 字节。
 * @param dest - 解压目标目录。
 */
function untar(buffer, dest) {
  const data = gunzipSync(buffer)
  let offset = 0
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break // 结束块
    const name = cString(header, 0, 100)
    const size = parseInt(cString(header, 124, 136), 8) || 0
    const typeflag = String.fromCharCode(header[156] ?? 0)
    offset += 512
    if (typeflag === 'L') { // GNU 长名：数据块是长名，后跟真实条目头
      const longName = data.subarray(offset, offset + size).toString('utf8').replace(/\0+$/, '')
      offset += Math.ceil(size / 512) * 512
      if (offset + 512 > data.length) break
      const real = data.subarray(offset, offset + 512)
      const realSize = parseInt(cString(real, 124, 136), 8) || 0
      const realType = String.fromCharCode(real[156] ?? 0)
      offset += 512
      if (realType !== '5' && !longName.endsWith('/')) {
        const full = join(dest, longName)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, data.subarray(offset, offset + realSize))
      } else {
        mkdirSync(join(dest, longName), { recursive: true })
      }
      offset += Math.ceil(realSize / 512) * 512
      continue
    }
    if (typeflag === '5' || name.endsWith('/')) { // 目录
      mkdirSync(join(dest, name), { recursive: true })
      continue
    }
    if (typeflag === 'x' || typeflag === 'g') { // pax 扩展头：跳过内容
      offset += Math.ceil(size / 512) * 512
      continue
    }
    const full = join(dest, name)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, data.subarray(offset, offset + size))
    offset += Math.ceil(size / 512) * 512
  }
}

function log(message) { process.stdout.write(`[dsh-prompt-enhancer] ${message}\n`) }
function fail(message) { process.stderr.write(`[dsh-prompt-enhancer] ✗ ${message}\n`); process.exit(1) }

process.on('exit', () => {
  if (REMOTE_DIR !== null) {
    try { rmSync(REMOTE_DIR, { recursive: true, force: true }) } catch { /* best effort */ }
  }
})

/** 定位 DSH checkout：参数 > DSH_CHECKOUT 环境变量 > 当前目录（向上探测 apps/cli）。 */
function resolveCheckout(arg) {
  const candidates = []
  if (arg !== undefined && arg !== '') candidates.push(resolve(arg))
  if (process.env.DSH_CHECKOUT !== undefined && process.env.DSH_CHECKOUT !== '') candidates.push(resolve(process.env.DSH_CHECKOUT))
  candidates.push(process.cwd())
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'apps', 'cli', 'package.json')) && existsSync(join(candidate, 'package.json'))) {
      return candidate
    }
  }
  const parent = resolve(process.cwd(), '..')
  if (existsSync(join(parent, 'apps', 'cli', 'package.json'))) return parent
  return undefined
}

/** 解析安装资源：本地存在即用本地；否则从 GitHub 下载仓库压缩包解压。 */
async function resolveResources() {
  if (existsSync(PATCH) && existsSync(PLUGIN_SRC)) return true
  log('未检测到本地安装资源，正在从 GitHub 下载…')
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pe-'))
  REMOTE_DIR = dir
  try {
    const response = await fetch(TARBALL_URL)
    if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)
    const tarball = join(dir, 'repo.tar.gz')
    writeFileSync(tarball, Buffer.from(await response.arrayBuffer()))
    const extracted = join(dir, 'x')
    mkdirSync(extracted, { recursive: true })
    try {
      untar(readFileSync(tarball), extracted)
    } catch (error) {
      throw new Error(`解压失败：${error.message}`)
    }
    const root = join(extracted, `dsh-prompt-enhancer-${REMOTE_BRANCH}`)
    PATCH = join(root, 'patch-0001-prompt-enhancer.patch')
    PLUGIN_SRC = join(root, 'plugin', 'ui-prompt-enhancer')
    if (!existsSync(PATCH) || !existsSync(PLUGIN_SRC)) throw new Error('下载的归档缺少安装资源')
    log('✓ 安装资源已就绪。')
    return true
  } catch (error) {
    log(`⚠ 远程资源下载失败：${error.message}`)
    return false
  }
}

function git(dsh, args) {
  return spawnSync('git', ['-C', dsh, ...args], { stdio: 'inherit' })
}

function hasRpc(dsh) {
  const map = join(dsh, 'packages', 'host', 'apiproxy', 'src', 'api', 'rpc-map.ts')
  if (!existsSync(map)) return false
  return readFileSync(map, 'utf8').includes(RPC_MARK)
}

function ensurePatch(dsh) {
  if (hasRpc(dsh)) { log('✓ 检测到 session.enhancePrompt RPC 已存在，跳过补丁。'); return }
  if (!existsSync(join(dsh, '.git'))) {
    fail(`目标目录不是 git 仓库（无法应用补丁）：${dsh}\n请使用 git clone 的 DSH checkout。`)
  }
  const reversed = git(dsh, ['apply', '--reverse', '--check', PATCH])
  if (reversed.status === 0) { log('✓ 补丁已应用，跳过。'); return }
  const check = git(dsh, ['apply', '--check', PATCH])
  if (check.status !== 0) {
    fail(`补丁无法干净应用（本地可能有冲突改动）：\n${check.stderr ?? ''}\n请人工处理或提供干净的 DSH checkout。`)
  }
  const applied = git(dsh, ['apply', PATCH])
  if (applied.status !== 0) fail(`补丁应用失败：\n${applied.stderr ?? ''}`)
  log('✓ apiproxy 补丁（session.enhancePrompt RPC）已应用。')
}

function ensurePlugin(dsh) {
  const dest = join(dsh, 'packages', 'client', 'ui-prompt-enhancer')
  if (existsSync(join(dest, 'package.json'))) {
    const manifest = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'))
    if (manifest.name === PLUGIN_NAME) { log('✓ 插件包已存在，跳过。'); return }
  }
  if (!existsSync(PLUGIN_SRC)) fail('缺少 plugin/ui-prompt-enhancer 目录（安装器包不完整）。')
  cpSync(PLUGIN_SRC, dest, { recursive: true, force: true })
  log('✓ 插件包已放置到 packages/client/ui-prompt-enhancer。')
}

function verifyWiring(dsh) {
  const issues = []
  const patchYml = join(dsh, 'packages', 'bundle', 'web-app', 'cordis.patch.yml')
  const webJson = join(dsh, 'packages', 'bundle', 'web-app', 'package.json')
  const tsconfig = join(dsh, 'tsconfig.base.json')
  if (!existsSync(patchYml) || !readFileSync(patchYml, 'utf8').includes(PLUGIN_NAME)) {
    issues.push('packages/bundle/web-app/cordis.patch.yml 缺少挂载行')
  }
  if (!existsSync(webJson) || !readFileSync(webJson, 'utf8').includes(PLUGIN_NAME)) {
    issues.push('packages/bundle/web-app/package.json 缺少依赖')
  }
  if (!existsSync(tsconfig) || !readFileSync(tsconfig, 'utf8').includes(PLUGIN_NAME)) {
    issues.push('tsconfig.base.json 缺少路径映射')
  }
  if (issues.length > 0) {
    log('⚠ 接线复核发现缺失项（补丁应已包含，请人工核对）：')
    for (const issue of issues) log(`   - ${issue}`)
  } else {
    log('✓ 组合接线复核通过。')
  }
}

function run(dsh, command, args) {
  log(`执行: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: dsh, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) fail(`${command} 失败（exit ${result.status}）`)
}

async function main() {
  const args = process.argv.slice(2)
  const flagIndex = args.findIndex(a => a.startsWith('--'))
  const positional = flagIndex === -1 ? args : args.slice(0, flagIndex)
  const flags = flagIndex === -1 ? [] : args.slice(flagIndex)
  const skipBuild = flags.includes('--skip-build')
  const withWeb = flags.includes('--with-web')

  const dsh = resolveCheckout(positional[0])
  if (dsh === undefined) {
    fail('未找到 DSH checkout。用法：node install.mjs <dshCheckoutPath>\n也可设置环境变量 DSH_CHECKOUT，或在 DSH checkout 根目录执行。')
  }
  log(`目标 DSH checkout: ${dsh}`)

  const resources = await resolveResources()
  if (!resources) fail('安装资源不可用：请 git clone 本仓库后运行，或检查网络后重试。')

  ensurePatch(dsh)
  ensurePlugin(dsh)
  verifyWiring(dsh)

  if (skipBuild) {
    log('已跳过构建（--skip-build）。请手动执行 pnpm install 与 pnpm run build。')
  } else {
    run(dsh, 'pnpm', ['install'])
    run(dsh, 'pnpm', ['run', 'build:lib:host'])
    run(dsh, 'pnpm', ['run', 'build:lib:client'])
    if (withWeb) run(dsh, 'pnpm', ['run', 'build:web'])
    else log('提示：浏览器 UI 需构建 web 产物。可执行 pnpm run build:web（或重跑安装器加 --with-web）。')
  }
  log('完成！请重启 dsh 进程并刷新浏览器。验证：输入框有内容 → 模型选择左侧出现魔法棒图标 → 点击增强；设置 → 通用设置 →「增强提示词」开关。')
}

main()
