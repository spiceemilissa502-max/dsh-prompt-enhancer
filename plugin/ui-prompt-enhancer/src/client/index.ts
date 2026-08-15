/**
 * Browser prompt-enhancer plugin: the composer trigger (left of the model
 * selector) plus the General settings toggle, over `session.enhancePrompt`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the ui-conversation SlotMap merge (conversation.input.right).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the ctx.slots Context merge + LocaleNamespaceMap.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { PROMPT_ENHANCER_SETTINGS_NAMESPACE } from '../settings.ts'
import type { PromptEnhancerSettings } from '../settings.ts'
import { PromptEnhancerController } from './controller.ts'
import { PromptEnhanceIcon, type PromptEnhanceIconInjected } from './PromptEnhanceIcon.tsx'
import { PromptEnhanceSetting, type PromptEnhanceSettingInjected } from './PromptEnhanceSetting.tsx'
import { en, NS, zh, type PromptEnhanceKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'prompt-enhancer': PromptEnhanceKey
  }
}

/** Services required by the prompt-enhancer plugin. */
export const inject = ['slots', 'connection', 'remote', 'settingsScope', 'locale']

/** Mount the prompt-enhancer plugin. */
export function apply(ctx: Context): void {
  const slots = ctx.slots

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-prompt-enhancer: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const host = ctx.settingsScope.bind<PromptEnhancerSettings>({ namespace: PROMPT_ENHANCER_SETTINGS_NAMESPACE })
  const controller = new PromptEnhancerController(connection.api, host)

  // Entry 1: the composer trigger, rendered left of the model selector.
  slots.inject('conversation.input.right', () => slots.register({
    name: 'conversation.input.right',
    id: 'prompt-enhancer',
    order: 0,
    locale: NS,
    inject: (sessionId: SessionId): PromptEnhanceIconInjected => ({
      hooks: { enabled: controller.enabled },
      enhance: (text) => controller.enhance(sessionId, text),
    }),
  }, PromptEnhanceIcon))

  // Entry 2: the enable/disable switch in General settings.
  slots.inject('settings.general.item', () => slots.register({
    name: 'settings.general.item',
    id: 'prompt-enhancer',
    order: 30,
    locale: NS,
    inject: (): PromptEnhanceSettingInjected => ({
      hooks: { enabled: controller.enabled },
      setEnabled: (enabled) => { controller.setEnabled(enabled) },
    }),
  }, PromptEnhanceSetting))
}
