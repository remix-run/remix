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
  border: '1px solid #d8d8d8',
  borderRadius: '8px',
  background: '#ffffff',
})

const itemCss = css({
  borderBlockStart: '1px solid #e8e8e8',
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
  color: '#101010',
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
    outline: '2px solid #3573f6',
    outlineOffset: '-2px',
  },
})

const contentCss = css({
  color: '#4f4f4f',
  font: '500 13px/20px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '0 12px 12px',
  '&[data-state="closed"]': {
    display: 'none',
  },
})
