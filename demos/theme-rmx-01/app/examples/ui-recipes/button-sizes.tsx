import { ui } from 'remix/theme'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button mix={[ui.button.base, ui.button.sm, ui.button.tone.secondary]}>
        <span mix={ui.button.label}>Small</span>
      </button>
      <button mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
        <span mix={ui.button.label}>Medium</span>
      </button>
      <button mix={[ui.button.base, ui.button.lg, ui.button.tone.secondary]}>
        <span mix={ui.button.label}>Large</span>
      </button>
      <button
        aria-label="Refresh"
        mix={[ui.button.base, ui.button.iconOnly, ui.button.tone.secondary]}
      >
        <span mix={ui.button.icon}>
          +
        </span>
      </button>
    </div>
  )
}
