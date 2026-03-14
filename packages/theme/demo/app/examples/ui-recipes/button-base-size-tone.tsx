import { Glyph, ui } from 'remix/theme'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button type="submit" mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
        <Glyph mix={ui.button.icon} name="add" />
        <span mix={ui.button.label}>Publish</span>
      </button>
      <a href="/proof-sheet" mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <span mix={ui.button.label}>View proof sheet</span>
        <Glyph mix={ui.button.icon} name="chevronRight" />
      </a>
    </div>
  )
}
