/** Composer trigger icon: renders left of the model selector, only while the draft is non-empty. */
import { useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { EnhanceResult } from './controller.ts'
import css from './PromptEnhanceIcon.module.css'

/** Sparkle/wand glyph supplied by the feature request. */
const SVG_PATH = 'M557.44 597.952a40.64 40.64 0 0 0-24.192 29.44l-67.2 140.288-112.192-117.888-4.672-4.352a46.72 46.72 0 0 0-23.104-9.792l-161.28-21.568 77.44-143.04 2.56-5.888a46.848 46.848 0 0 0 2.304-24.96l-29.376-160.128 160 29.44c10.56 1.92 21.376 0.256 30.784-4.864L551.68 227.2v-0.064l21.568 161.408 1.28 6.272a46.848 46.848 0 0 0 12.8 21.44l117.952 112.256-140.288 67.2a40.576 40.576 0 0 0-7.488 2.304v-0.064z m85.824 50.304l142.016-67.968 5.632-3.2a46.976 46.976 0 0 0 6.4-73.024l-145.152-138.24-26.56-198.656A46.848 46.848 0 0 0 556.8 132.096L380.544 227.392l-197.248-36.096-6.4-0.768a46.848 46.848 0 0 0-48.128 55.296l36.16 197.184-95.36 176.32-2.56 5.824a46.848 46.848 0 0 0 37.632 62.912l198.784 26.432 138.24 145.28 4.672 4.352a46.72 46.72 0 0 0 71.488-16.448l67.968-141.888 208.448 208.384a40.576 40.576 0 1 0 57.472-57.472l-208.448-208.448z m210.368-570.368a40.576 40.576 0 0 0-66.88 8.512l-31.296 62.464a40.576 40.576 0 0 0 72.576 36.288l31.232-62.464a40.64 40.64 0 0 0-5.632-44.8zM960 313.856a40.576 40.576 0 0 0-55.296-38.784l-65.152 25.152a40.576 40.576 0 1 0 29.376 75.712l65.088-25.152A40.576 40.576 0 0 0 960 313.856z'

/** Registration-side injected face for the composer icon. */
export interface PromptEnhanceIconInjected {
  hooks: { enabled: SnapshotStore<boolean> }
  enhance: (text: string) => Promise<EnhanceResult>
}

/** Full icon props: composer tool-row seat + locale + inject face. */
export type PromptEnhanceIconProps =
  PropsRuntime<'conversation.input.right'>
  & PropsLocale<'prompt-enhancer'>
  & InjectFace<PromptEnhanceIconInjected>

/**
 * Render the trigger icon. Hidden while disabled or empty; clicking runs the
 * enhancement and writes the result back through the public draft path.
 */
export function PromptEnhanceIcon({
  input, inputActions, useEnabled, enhance, t,
}: PromptEnhanceIconProps) {
  const enabled = useEnabled(value => value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draft = input.draft
  if (!enabled || draft.trim().length === 0) return null

  const tipText = busy ? t('icon.pending') : (error ?? t('icon.label'))

  function onClick(): void {
    if (busy) return
    setBusy(true)
    setError(null)
    enhance(draft).then(
      (result) => {
        setBusy(false)
        if (result.text.trim().length > 0) inputActions.setDraft(result.text)
        else setError(t('icon.failed'))
      },
      (err: unknown) => {
        setBusy(false)
        setError(err instanceof Error ? err.message : String(err))
      },
    )
  }

  return (
    <div className={css.wrap}>
      <button
        type="button"
        className={busy ? `${css.btn} ${css.busy}` : css.btn}
        aria-label={tipText}
        title={tipText}
        disabled={busy}
        onMouseDown={(event) => { event.preventDefault() }}
        onClick={onClick}
      >
        <svg viewBox="0 0 1024 1024" width="16" height="16" aria-hidden focusable="false">
          <path d={SVG_PATH} fill="currentColor" />
        </svg>
      </button>
      <span className={css.tip} role="tooltip">{tipText}</span>
    </div>
  )
}
