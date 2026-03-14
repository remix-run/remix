import { ui } from 'remix/theme'
import { buttonScrollRowCss, buttonSpinnerGlyphCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
        <span mix={ui.button.icon}>
          +
        </span>
        <span mix={ui.button.label}>New issue</span>
      </button>

      <button mix={[ui.button.base, ui.button.md, ui.button.tone.ghost]}>
        <span mix={ui.button.label}>Open</span>
        <span mix={ui.button.icon}>
          →
        </span>
      </button>

      <button disabled mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <span mix={ui.button.label}>Disabled</span>
      </button>

      <button aria-busy="true" mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <span mix={[ui.button.icon, buttonSpinnerGlyphCss]}>
          ◌
        </span>
        <span mix={ui.button.label}>Saving</span>
      </button>
    </div>
  )
}
