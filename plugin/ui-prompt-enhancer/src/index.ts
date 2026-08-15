/** Host registration for the prompt-enhancer preference. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { PROMPT_ENHANCER_SETTINGS_NAMESPACE, PromptEnhancerSettingsSchema } from './settings.ts'

export {
  PROMPT_ENHANCER_SETTINGS_NAMESPACE, ENABLED_FIELD, DEFAULT_ENABLED,
  type PromptEnhancerSettings,
} from './settings.ts'

/**
 * Register the durable prompt-enhancer section when a settings provider exists.
 * @param ctx - Host context whose optional settings service owns the section.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(PROMPT_ENHANCER_SETTINGS_NAMESPACE),
      PromptEnhancerSettingsSchema,
    )
  })
}
