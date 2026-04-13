import { css } from 'remix/component'
import { Glyph, ui } from 'remix/ui'

export default function Example() {
  return () => (
    <article mix={[ui.card.base, cardCss]}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>ui.card.* + ui.button.*</p>
        <h3 mix={ui.card.title}>UI is the reusable styling vocabulary.</h3>
        <p mix={ui.card.description}>
          Mixins keep recurring visual structure consistent so components and app code are not
          rebuilding the same styling decisions from scratch.
        </p>
      </div>
      <div mix={actionRowCss}>
        <button mix={ui.button.secondary}>
          <span mix={ui.button.label}>Review</span>
        </button>
        <button mix={ui.button.primary}>
          <Glyph mix={ui.button.icon} name="add" />
          <span mix={ui.button.label}>Create</span>
        </button>
      </div>
    </article>
  )
}

let cardCss = css({
  gap: '20px',
  minHeight: '100%',
})

let actionRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
})
