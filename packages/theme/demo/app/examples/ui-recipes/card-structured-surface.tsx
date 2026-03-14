import { ui } from 'remix/theme'
import { cardExampleFrameCss, statusBadgeCss } from './shared.ts'

export default function Example() {
  return () => (
    <article mix={[ui.card.base, cardExampleFrameCss]}>
      <div mix={ui.card.headerWithAction}>
        <div mix={ui.card.header}>
          <p mix={ui.card.eyebrow}>Surface</p>
          <h4 mix={ui.card.title}>Card header</h4>
          <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
        </div>
        <span mix={[ui.card.action, statusBadgeCss, ui.status.info]}>Info</span>
      </div>
      <div mix={ui.card.body}>
        <div mix={ui.text.bodySm}>
          Body content can stay simple because the structural spacing is already solved.
        </div>
      </div>
      <div mix={ui.card.footer}>
        <button mix={ui.button.secondary}>Cancel</button>
        <button mix={ui.button.primary}>Continue</button>
      </div>
    </article>
  )
}
