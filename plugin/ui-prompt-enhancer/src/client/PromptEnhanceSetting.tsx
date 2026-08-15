/** General Settings row for the prompt-enhancer enable/disable switch. */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './PromptEnhanceSetting.module.css'

/** Registration-side injected face for the Settings row. */
export interface PromptEnhanceSettingInjected {
  hooks: { enabled: SnapshotStore<boolean> }
  setEnabled: (enabled: boolean) => void
}

/** Full Settings-row props. */
export type PromptEnhanceSettingProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'prompt-enhancer'>
  & InjectFace<PromptEnhanceSettingInjected>

/** Render the toggle row: title + description on the left, switch on the right. */
export function PromptEnhanceSetting({ useEnabled, setEnabled, t }: PromptEnhanceSettingProps) {
  const enabled = useEnabled(value => value)

  return (
    <div className={css.row}>
      <div className={css.text}>
        <div className={css.title}>{t('setting.title')}</div>
        <div className={css.desc}>{t('setting.description')}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('setting.toggle')}
        className={css.switch}
        data-on={enabled ? 'true' : 'false'}
        onClick={() => { setEnabled(!enabled) }}
      >
        <span className={css.knob} />
      </button>
    </div>
  )
}
