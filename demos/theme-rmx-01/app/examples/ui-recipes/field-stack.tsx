import { ui } from 'remix/theme'
import { fieldStackCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={[ui.stack, ui.gap.xs, fieldStackCss]}>
      <label for="example-field" mix={ui.fieldText.label}>
        Project name
      </label>
      <input id="example-field" value="RMX Internal Console" readOnly mix={ui.field.base} />
      <div mix={ui.fieldText.help}>Shown in navigation, notifications, and audit logs.</div>
    </div>
  )
}
