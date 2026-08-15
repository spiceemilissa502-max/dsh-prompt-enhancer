# 安装指南

**插件**：`@deepseek-ai/dsh-client-ui-prompt-enhancer`（增强提示词）
**目标 DSH 版本**：`0.1.0-rc.5`
**仓库结构**：
```
dsh-prompt-enhancer/
├── README.md
├── INSTALL.md                        # 本文档
├── LICENSE                           # MIT
├── patch-0001-prompt-enhancer.patch  # 统一补丁（apiproxy RPC + 接线 + 测试）
└── plugin/
    └── ui-prompt-enhancer/           # 插件包源码
```

## 0. 前提

1. 接收方 DSH 与打包方版本一致（`0.1.0-rc.5`）。
2. 插件依赖新增宿主 RPC `session.enhancePrompt`，补丁已包含该改动；**必须应用补丁**（除非接收方 DSH 已含此 RPC）。
3. 安装方为 DSH 部署维护者（可执行 `pnpm install` / `pnpm run build` 并重启）。
4. 安全提示：补丁含 apiproxy 改动（新增一个 RPC 方法），应用前请审阅 `patch-0001-prompt-enhancer.patch`。

## 1. 安装

在 DSH checkout 根目录执行：

```bash
# 1) 应用补丁（先干跑确认可干净应用）
git apply --check path/to/patch-0001-prompt-enhancer.patch
git apply path/to/patch-0001-prompt-enhancer.patch

# 2) 放置插件包（patch 不含新包，必须单独放置）
cp -r plugin/ui-prompt-enhancer packages/client/ui-prompt-enhancer

# 3) 安装依赖并构建
pnpm install
pnpm run build          # 等价于 build:lib:host + build:lib:client + build:web

# 4) 重启 dsh，浏览器刷新
```

> 若 `git apply` 报冲突（本地改过相关文件），按下方「接线速查」手工核对。

## 2. 接线速查（补丁已自动完成，核对用）

| 文件 | 需要的内容 |
|---|---|
| `packages/bundle/web-app/cordis.patch.yml` | 追加行：`- id: ui-prompt-enhancer` / `name: '@deepseek-ai/dsh-client-ui-prompt-enhancer'` |
| `packages/bundle/web-app/package.json` | dependencies 追加：`"@deepseek-ai/dsh-client-ui-prompt-enhancer": "workspace:^"` |
| `tsconfig.base.json` | paths 追加：`"@deepseek-ai/dsh-client-ui-prompt-enhancer": ["./packages/client/ui-prompt-enhancer/src"]` |
| `tsconfig.client.json` | references 追加：`{ "path": "./packages/client/ui-prompt-enhancer" }` |

## 3. 验证

1. 输入框输入内容 → 模型选择左侧出现魔法棒图标（悬停「增强提示词」）；
2. 点击图标 → 内容被润色替换（期间提示「增强中…」）；
3. 设置 → 通用设置 → 「增强提示词」开关可切换。

## 4. 卸载 / 回滚

```bash
git apply -R path/to/patch-0001-prompt-enhancer.patch
rm -rf packages/client/ui-prompt-enhancer
pnpm install && pnpm run build
```
