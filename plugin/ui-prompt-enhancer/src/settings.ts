/** Durable settings section owned by the prompt-enhancer plugin. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the prompt-enhancer plugin. */
export const PROMPT_ENHANCER_SETTINGS_NAMESPACE = 'ui-prompt-enhancer'

/** Field carrying the enable/disable switch. */
export const ENABLED_FIELD = 'enabled'

/** Default is on: the feature is available until the user opts out. */
export const DEFAULT_ENABLED = true

/** Durable prompt-enhancer section shared by the Host schema and the browser scope. */
export interface PromptEnhancerSettings {
  /** Whether the composer trigger and its enhancement call are enabled. */
  enabled: boolean
}

/** Durable prompt-enhancer schema; also the wire envelope the browser scope validates against. */
export const PromptEnhancerSettingsSchema: z<PromptEnhancerSettings> = z.object({
  [ENABLED_FIELD]: z.boolean().default(DEFAULT_ENABLED),
})
