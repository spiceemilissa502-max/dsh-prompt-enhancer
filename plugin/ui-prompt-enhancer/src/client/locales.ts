/** `prompt-enhancer` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'prompt-enhancer'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'icon.label': '增强提示词',
  'icon.pending': '增强中…',
  'icon.failed': '增强失败',
  'setting.title': '增强提示词',
  'setting.description': '在输入框下方模型选择左侧显示触发图标，调用模型润色并增强提示词。',
  'setting.toggle': '启用增强提示词',
} satisfies Record<string, string>

/** The prompt-enhancer namespace key union. */
export type PromptEnhanceKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'icon.label': 'Enhance prompt',
  'icon.pending': 'Enhancing…',
  'icon.failed': 'Enhancement failed',
  'setting.title': 'Enhance prompt',
  'setting.description': 'Show a trigger icon left of the model selector under the composer to polish and enhance the prompt with a model.',
  'setting.toggle': 'Enable prompt enhancement',
} satisfies Record<PromptEnhanceKey, string>
