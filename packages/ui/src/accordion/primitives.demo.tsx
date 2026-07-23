import { css } from '@remix-run/ui'
import * as accordion from '@remix-run/ui/accordion/primitives'

/**
 * @name Accordion Primitives
 * @description Headless accordion behavior with minimal local styles.
 * @layout center
 */
export default function Example() {
  return () => (
    <accordion.Context defaultValue="shipping">
      <div mix={[rootCss, accordion.root()]}>
        <accordion.ItemContext value="shipping">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Shipping
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              Default carrier, cutoff time, and delivery windows.
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="billing">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Billing
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              Invoice cadence, billing contact, and tax settings.
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext disabled value="archived">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Archived
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>Unavailable settings.</div>
          </div>
        </accordion.ItemContext>
      </div>
    </accordion.Context>
  )
}

const rootCss = css({
  display: 'grid',
  width: '24rem',
  maxWidth: '100%',
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '8px',
  background: 'light-dark(#ffffff, #1a1a1a)',
})

const itemCss = css({
  borderBlockStart: '1px solid light-dark(#e7e7e7, #333333)',
  '&:first-child': {
    borderBlockStart: 0,
  },
  '&[data-disabled]': {
    opacity: 0.45,
  },
})

const headingCss = css({
  margin: 0,
})

const triggerCss = css({
  appearance: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  border: 0,
  background: 'transparent',
  color: 'light-dark(#151515, #ececec)',
  font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '10px 12px',
  textAlign: 'left',
  '&::after': {
    content: '"+"',
  },
  '&[data-state="open"]::after': {
    content: '"-"',
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#3573f6, #6eaaff)',
    outlineOffset: '-2px',
  },
})

const contentCss = css({
  color: 'light-dark(#4f4f4f, #b3b3b3)',
  font: '500 13px/20px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '0 12px 12px',
  '&[data-state="closed"]': {
    display: 'none',
  },
})
