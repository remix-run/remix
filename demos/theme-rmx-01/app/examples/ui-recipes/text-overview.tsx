import { ui } from 'remix/theme'

export default function Example() {
  return () => (
    <div mix={[ui.stack, ui.gap.sm]}>
      <p mix={ui.text.eyebrow}>Page eyebrow</p>
      <p mix={ui.text.title}>Section title</p>
      <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
    </div>
  )
}
