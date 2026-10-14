import { css } from 'remix/component'
import * as accordion from '@remix-run/ui/accordion'

export default function Example() {
  return () => (
    <accordion.Context defaultValue="shipping">
      <div mix={[rootCss, accordion.root()]}>
        <accordion.ItemContext value="shipping">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Shipping
                <ChevronDownIcon />
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              <div mix={contentInnerCss}>
                <p mix={descriptionCss}>
                  Choose a delivery window and track your order. We’ll send you a tracking link as
                  soon as your order is on its way.
                </p>
              </div>
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="billing">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Billing
                <ChevronDownIcon />
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              <div mix={contentInnerCss}>
                <p mix={descriptionCss}>
                  Review invoices and update your billing details. Changes apply to your next
                  billing cycle.
                </p>
              </div>
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="returns">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Returns
                <ChevronDownIcon />
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              <div mix={contentInnerCss}>
                <p mix={descriptionCss}>
                  Return unused items within 30 days. Arrange a return and track your refund from
                  your account.
                </p>
              </div>
            </div>
          </div>
        </accordion.ItemContext>
      </div>
    </accordion.Context>
  )
}

const rootCss = css({
  colorScheme: 'light dark',
  width: '28rem',
  maxWidth: '100%',
  overflow: 'hidden',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#ffffff, #1b1b20)',
  color: 'light-dark(#202027, #eeeef2)',
  boxShadow: '0 4px 16px light-dark(#20202708, #00000020)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const itemCss = css({
  borderBlockStart: '1px solid light-dark(#ebebef, #303037)',
  '&:first-child': { borderBlockStart: 0 },
  '&[data-disabled]': { opacity: 0.4 },
})

const headingCss = css({ margin: 0 })

const triggerCss = css({
  appearance: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  width: '100%',
  padding: '18px 20px',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background-color 160ms ease',
  '&:hover:not(:disabled)': { background: 'light-dark(#f7f7fa, #24242b)' },
  '&:disabled': { cursor: 'default' },
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #5bb8ef)',
    outlineOffset: '-3px',
    borderRadius: '8px',
  },
  '& svg': {
    flexShrink: 0,
    color: 'light-dark(#787881, #9999a5)',
    transition: 'transform 280ms cubic-bezier(0.2, 0, 0, 1)',
  },
  '&[data-state="open"] svg': { transform: 'rotate(180deg)' },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '& svg': { transition: 'none' },
  },
})

const contentCss = css({
  display: 'grid',
  gridTemplateRows: '0fr',
  opacity: 0,
  transition: 'grid-template-rows 280ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease',
  '&[data-state="open"]': { gridTemplateRows: '1fr', opacity: 1 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

const contentInnerCss = css({ minHeight: 0, overflow: 'hidden' })

const descriptionCss = css({
  margin: 0,
  padding: '0 20px 20px',
  color: 'light-dark(#62626c, #b0b0bb)',
  font: 'inherit',
})

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}
