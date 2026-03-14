import { ui } from 'remix/theme'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button type="submit" mix={ui.button.primary}>
        Save
      </button>
      <button mix={ui.button.secondary}>Secondary</button>
      <button mix={ui.button.ghost}>Ghost</button>
      <button mix={ui.button.danger}>Delete</button>
    </div>
  )
}
