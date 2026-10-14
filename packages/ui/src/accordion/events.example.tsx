import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as accordion from '@remix-run/ui/accordion'

export default function Example(handle: Handle) {
  let activeSection: string | null = 'shipping'
  return () => (
    <div
      mix={[
        stackCss,
        accordion.onAccordionChange((event) => {
          activeSection = typeof event.value === 'string' ? event.value : null
          handle.update()
        }),
      ]}
    >
      <header mix={summaryCss}>
        <div mix={summaryIconCss} aria-hidden="true">
          {activeSection === 'billing' ? (
            <CreditCardIcon />
          ) : activeSection === 'shipping' ? (
            <TruckIcon />
          ) : (
            <ReceiptIcon />
          )}
        </div>
        <div>
          <p mix={eyebrowCss}>Order #RMX-1042</p>
          <p mix={summaryTitleCss} aria-live="polite">
            {activeSection === 'shipping'
              ? 'Delivery details'
              : activeSection === 'billing'
                ? 'Payment details'
                : 'Order overview'}
          </p>
        </div>
        <span mix={totalCss}>$128.00</span>
      </header>
      <accordion.Context defaultValue="shipping">
        <div mix={[rootCss, accordion.root()]}>
          <Item value="shipping" title="Shipping" />
          <Item value="billing" title="Billing" />
        </div>
      </accordion.Context>
    </div>
  )
}

function Item(handle: Handle<{ value: string; title: string; disabled?: boolean }>) {
  return () => (
    <accordion.ItemContext value={handle.props.value} disabled={handle.props.disabled}>
      <div mix={[itemCss, accordion.item()]}>
        <h3>
          <button type="button" mix={accordion.trigger()}>
            {handle.props.title}
            <ChevronDownIcon />
          </button>
        </h3>
        <div mix={[contentCss, accordion.content()]}>
          <div mix={css({ minHeight: 0, overflow: 'hidden' })}>
            <p>
              {handle.props.value === 'shipping'
                ? 'Standard delivery in 2–4 business days. Tracking is sent when your order ships.'
                : handle.props.value === 'billing'
                  ? 'Visa ending in 4242. Your receipt will be sent to the email on your account.'
                  : 'Past orders and receipts are saved here for your records.'}
            </p>
          </div>
        </div>
      </div>
    </accordion.ItemContext>
  )
}

const stackCss = css({
  colorScheme: 'light dark',
  display: 'grid',
  gap: '16px',
  width: '28rem',
  maxWidth: '100%',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})
const rootCss = css({
  overflow: 'hidden',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#ffffff, #1b1b20)',
  '& h3': { margin: 0 },
  '& button': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '18px 20px',
    border: 0,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    '&:disabled': { cursor: 'default' },
    '&:hover:not(:disabled)': { background: 'light-dark(#f7f7fa, #24242b)' },
    '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '-3px' },
    '& svg': { transition: 'transform 280ms ease' },
    '&[data-state="open"] svg': { transform: 'rotate(180deg)' },
  },
  '& p': { margin: 0, padding: '0 20px 20px', color: 'light-dark(#62626c, #b0b0bb)' },
  '@media (prefers-reduced-motion: reduce)': { '& button svg': { transition: 'none' } },
})
const itemCss = css({
  borderTop: '1px solid light-dark(#ebebef, #303037)',
  '&:first-child': { borderTop: 0 },
  '&[data-disabled]': { opacity: 0.4 },
})
const contentCss = css({
  display: 'grid',
  gridTemplateRows: '0fr',
  opacity: 0,
  transition: 'grid-template-rows 280ms ease, opacity 200ms ease',
  '&[data-state="open"]': { gridTemplateRows: '1fr', opacity: 1 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

const summaryCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '16px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
})
const summaryIconCss = css({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: '44px',
  height: '44px',
  borderRadius: '10px',
  color: 'light-dark(#0578be, #5bb8ef)',
  background: 'light-dark(#eaf5fc, #5bb8ef15)',
})
const eyebrowCss = css({
  margin: 0,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'light-dark(#62626c, #b0b0bb)',
})
const summaryTitleCss = css({
  margin: '2px 0 0',
  fontWeight: 600,
  color: 'light-dark(#202027, #eeeef2)',
})
const totalCss = css({
  marginLeft: 'auto',
  fontSize: '13px',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
})

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}

function CreditCardIcon() {
  return () => (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  )
}

function TruckIcon() {
  return () => (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 6h11v11H3zM14 10h4l3 4v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

function ReceiptIcon() {
  return () => (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}
