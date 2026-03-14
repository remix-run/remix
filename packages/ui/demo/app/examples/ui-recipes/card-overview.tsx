import { ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={ui.card.base}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>Surface</p>
        <h4 mix={ui.card.title}>Card header</h4>
        <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
      </div>
    </div>
  )
}
