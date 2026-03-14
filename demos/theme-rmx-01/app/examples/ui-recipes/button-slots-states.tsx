import { Glyph, ui } from 'remix/theme'
import { buttonScrollRowCss, buttonSpinnerGlyphCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
        <Glyph mix={ui.button.icon} name="add" />
        <span mix={ui.button.label}>New issue</span>
      </button>

      <button mix={[ui.button.base, ui.button.md, ui.button.tone.ghost]}>
        <span mix={ui.button.label}>Open</span>
        <Glyph mix={ui.button.icon} name="chevronRight" />
      </button>

      <button disabled mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <span mix={ui.button.label}>Disabled</span>
      </button>

      <button aria-busy="true" mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <Glyph mix={[ui.button.icon, buttonSpinnerGlyphCss]} name="spinner" />
        <span mix={ui.button.label}>Saving</span>
      </button>
    </div>
  )
}
