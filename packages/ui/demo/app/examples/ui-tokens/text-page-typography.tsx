import { ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={[ui.stack, ui.gap.sm]}>
      <p mix={ui.text.eyebrow}>Page eyebrow</p>
      <p mix={ui.text.title}>Section title</p>
      <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
      <p mix={ui.text.supporting}>Supporting notes can back away when needed.</p>
      <code mix={ui.text.code}>theme.surface.lvl0</code>
    </div>
  )
}
