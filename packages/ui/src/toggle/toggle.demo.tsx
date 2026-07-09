import { css } from '@remix-run/ui'
import toggle from '@remix-run/ui/toggle'

/**
 * @name Toggle Basic
 * @description Styled switch mixins for native checkbox inputs.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={toggleDemoCss}>
      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Styled input mixin</h2>
        <label mix={optionCss}>
          <input defaultChecked mix={toggle()} name="preferences" value="email" />
          Email notifications
        </label>
        <label mix={optionCss}>
          <input mix={toggle({ size: 'lg' })} name="preferences" value="desktop" />
          Desktop alerts large
        </label>
        <label mix={optionCss}>
          <input disabled mix={toggle()} name="preferences" value="digest" />
          Weekly digest
        </label>
        <label mix={optionCss}>
          <input defaultChecked mix={toggle({ size: 'lg' })} name="preferences" value="sync" />
          Automatic sync
        </label>
      </section>
    </div>
  )
}

const toggleDemoCss = css({
  display: 'grid',
  gap: '28px',
  width: 'min(100%, 22rem)',
})

const sectionCss = css({
  display: 'grid',
  gap: '10px',
})

const sectionLabelCss = css({
  margin: 0,
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '12px',
  lineHeight: '16px',
  fontWeight: 650,
  letterSpacing: 0,
  color: 'light-dark(rgb(16 16 16 / 0.72), rgb(236 236 236 / 0.72))',
})

const optionCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '28px',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 500,
  letterSpacing: 0,
  color: 'light-dark(#151515, #ececec)',
})
