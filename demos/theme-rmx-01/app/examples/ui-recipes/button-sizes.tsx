import { ui } from 'remix/theme'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button mix={[ui.button.base, ui.button.sm, ui.button.tone.secondary]}>Small</button>
      <button mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>Medium</button>
      <button mix={[ui.button.base, ui.button.lg, ui.button.tone.secondary]}>Large</button>
      <button aria-label="Refresh" mix={[ui.button.base, ui.button.icon, ui.button.tone.secondary]}>
        <span data-slot="icon" aria-hidden="true">
          +
        </span>
      </button>
    </div>
  )
}
