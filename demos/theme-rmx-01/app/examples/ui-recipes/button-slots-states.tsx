import { ui } from 'remix/theme'
import { buttonScrollRowCss, buttonSpinnerGlyphCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
        <span data-slot="icon" aria-hidden="true">
          +
        </span>
        <span data-slot="label">New issue</span>
      </button>

      <button mix={[ui.button.base, ui.button.md, ui.button.tone.ghost]}>
        <span data-slot="label">Open</span>
        <span data-slot="icon" aria-hidden="true">
          →
        </span>
      </button>

      <button disabled mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        Disabled
      </button>

      <button aria-busy="true" mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <span data-slot="icon" aria-hidden="true" mix={buttonSpinnerGlyphCss}>
          ◌
        </span>
        <span data-slot="label">Saving</span>
      </button>
    </div>
  )
}
