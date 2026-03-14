import { ui } from 'remix/theme'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button type="submit" mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
        Publish
      </button>
      <a href="/proof-sheet" mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        View proof sheet
      </a>
    </div>
  )
}
