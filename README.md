# DSH Prompt Enhancer · 增强提示词插件

> 为 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai/deepseek-harness) 开发的提示词增强插件：
> 在输入框模型选择左侧提供触发图标，一键调用模型把草稿提示词润色为更专业、更利于 AI Agent
> 理解执行的形式，并回填到输入框；可在「设置 → 通用设置」中开关。

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 功能特性

- **一键增强**：输入框内容非空时，模型选择左侧显示触发图标（悬停提示「增强提示词」），点击即调用模型润色并替换原文。
- **模型策略**：官方 DeepSeek（`deepseek-official`）→ 使用 `deepseek-v4-flash`；非官方模型 → 回退到用户配置的默认模型。
- **响应优化**：官方模型显式关闭推理（`reasoningEffort: 'off'`）、`maxTokens` 收紧、同草稿 LRU 缓存 + 并发去重（重复增强秒回）。
- **设置开关**：「设置 → 通用设置」新增启用/关闭开关，持久化于 `ui-prompt-enhancer` 设置命名空间。
- **国际化**：中 / 英词典。

## 架构

```
┌─ 浏览器（client 包 @deepseek-ai/dsh-client-ui-prompt-enhancer）─┐
│  conversation.input.right  触发图标（读 input.draft → 点击调用） │
│  settings.general.item     通用设置开关（settingsScope 读写）    │
└───────────────┬─────────────────────────────────────────────────┘
                │ RPC: session.enhancePrompt { sessionId, text }
┌───────────────▼─────────────────────────────────────────────────┐
│  宿主 apiproxy（补丁新增 RPC）                                    │
│  模型策略 → llm.stream（reasoningEffort: off / 默认模型）          │
│  LRU 缓存 + 并发去重 → { text, provider, model }                  │
└──────────────────────────────────────────────────────────────────┘
```

## 兼容性

- **目标 DSH 版本：`0.1.0-rc.5`**（插件 peerDependencies 依赖同版本 `@deepseek-ai/dsh-*` 工作区包）。
- **依赖新增宿主 RPC `session.enhancePrompt`**：补丁 `patch-0001-prompt-enhancer.patch` 包含该 apiproxy 改动，安装时必须应用（若接收方 DSH 已含该 RPC 可跳过）。

> ⚠️ 目前不提供 npm 包分发：`@deepseek-ai/dsh-*@0.1.0-rc.5` 尚未发布到公开 npm（仅有旧版 `0.0.1-rc.1`），
> peerDependencies 无法在 npm 上解析。本仓库以**源码 + 补丁**形态开源，安装方为 DSH 部署维护者。

## 安装

见 [INSTALL.md](INSTALL.md)。核心步骤（DSH `0.1.0-rc.5` checkout 根目录）：

```bash
# 1. 应用补丁（apiproxy 新 RPC + 组合接线 + 测试）
git apply --check patch-0001-prompt-enhancer.patch && git apply patch-0001-prompt-enhancer.patch
# 2. 放置插件包
cp -r plugin/ui-prompt-enhancer packages/client/ui-prompt-enhancer
# 3. 安装并构建
pnpm install && pnpm run build
# 4. 重启 dsh，刷新浏览器
```

## 使用

1. 在输入框输入任意内容 → 模型选择左侧出现魔法棒图标。
2. 点击图标 → 输入框内容被润色替换（图标转圈期间提示「增强中…」）。
3. 设置 → 通用设置 → 「增强提示词」开关可随时启用/关闭。

## 从源码开发

```bash
cd plugin/ui-prompt-enhancer
pnpm --filter @deepseek-ai/dsh-client-ui-prompt-enhancer run bundle   # 或 pnpm run dev:web 做 HMR
```

## 开源协议

[MIT](LICENSE)

---

*本插件是 DSH 的组成部分：代码开源供审阅、贡献与自用；欢迎向 DSH 主仓库提交改进。*
