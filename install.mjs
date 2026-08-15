#!/usr/bin/env node
/**
 * DSH Prompt Enhancer — 一键安装器（零依赖，Node ≥ 18）
 *
 * 用法：
 *   node install.mjs [dshCheckoutPath] [--skip-build] [--with-web]
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
import { existsSync, readFileSync, cpSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PATCH = join(HERE, 'patch-0001-prompt-enhancer.patch')
const PLUGIN_SRC = join(HERE, 'plugin', 'ui-prompt-enhancer')
const PLUGIN_NAME = '@deepseek-ai/dsh-client-ui-prompt-enhancer'
const RPC_MARK = "session.enhancePrompt': SessionsApi['enhancePrompt'"

function dirname(url) { return url.replace(/[\\/][^\\/]*$/, '') }

function log(message) { process.stdout.write(`[dsh-prompt-enhancer] ${message}\n`) }
function fail(message) { process.stderr.write(`[dsh-prompt-enhancer] ✗ ${message}\n`); process.exit(1) }

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
  // 当前目录不是根：向父目录探测一次（常见于在 packages/ 下执行）
  const parent = resolve(process.cwd(), '..')
  if (existsSync(join(parent, 'apps', 'cli', 'package.json'))) return parent
  return undefined
}

function git(dsh, args) {
  return spawnSync('git', ['-C', dsh, ...args], { stdio: 'pipe', encoding: 'utf8' })
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
    fail(`补丁无法干净应用（本地可能有冲突改动）：\n${check.stderr ?? ''}\n请人工处理或提供干净的 0.1.0-rc.5 checkout。`)
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

function main() {
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
