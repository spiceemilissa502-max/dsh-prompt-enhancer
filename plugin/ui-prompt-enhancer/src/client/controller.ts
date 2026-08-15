/**
 * Prompt-enhancer policy: the live enable/disable flag plus the one-shot
 * enhancement call over `session.enhancePrompt`. Mirrors the composer's
 * submission-policy shape so the icon and the Settings row share one source.
 */

import {
  createSnapshotStore, type SessionId, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { ENABLED_FIELD, DEFAULT_ENABLED } from '../settings.ts'
import type { PromptEnhancerSettings } from '../settings.ts'

/** The rewritten prompt plus the route that produced it. */
export interface EnhanceResult {
  text: string
  provider: string
  model: string
}

/** Owns the reactive preference and the one-shot model call. */
export class PromptEnhancerController {
  /** Reactive enabled source for both the icon and the Settings row. */
  readonly enabled: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_ENABLED)
  private readonly host: SettingsScope<PromptEnhancerSettings> | undefined

  /**
   * @param api - the browser RPC face carrying `session.enhancePrompt`.
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local.
   */
  constructor(
    private readonly api: Pick<IApiClient, 'sessions'>,
    host?: SettingsScope<PromptEnhancerSettings>,
  ) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /** Change the enable flag; the live value publishes before the durable write. */
  setEnabled(enabled: boolean): void {
    if (this.enabled.getSnapshot() === enabled) return
    this.enabled.set(enabled)
    void this.host?.set(ENABLED_FIELD, enabled)
  }

  /** Run one enhancement call; rejects with the wire error message on failure. */
  async enhance(sessionId: SessionId, text: string): Promise<EnhanceResult> {
    const response = await this.api.sessions.enhancePrompt({ sessionId, text })
    if (!response.result.ok) throw new Error(response.result.error.message)
    return response.result.value
  }

  /** Adopt the scope's accepted durable flag without writing it back. */
  private adopt(host: SettingsScope<PromptEnhancerSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined || this.enabled.getSnapshot() === section.enabled) return
    this.enabled.set(section.enabled)
  }
}
