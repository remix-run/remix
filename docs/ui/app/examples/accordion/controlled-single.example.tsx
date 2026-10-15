import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as accordion from '@remix-run/ui/accordion'

export default function Example(handle: Handle) {
  let value: string | null = 'shipping'
  return () => (
    <div mix={stackCss}>
      <div role="radiogroup" aria-label="Open order section" mix={toolbarCss}>
        {sections.map((section) => (
          <label key={section.value} mix={radioCss}>
            <input
              type="radio"
              name={`${handle.id}-section`}
              value={section.value}
              checked={value === section.value}
              mix={[
                visuallyHiddenCss,
                on('click', () => {
                  value = value === section.value ? null : section.value
                  handle.update()
                }),
              ]}
            />
            <PlusIcon selected={value === section.value} />
            {section.title}
          </label>
        ))}
      </div>
      <accordion.Context
        value={value}
        onValueChange={(next) => {
          value = next
          handle.update()
        }}
      >
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
                  ? 'Card ending in 4242. Your receipt will be sent to the email on your account.'
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
    '&:disabled': { cursor: 'not-allowed' },
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

const sections = [
  { value: 'shipping', title: 'Shipping' },
  { value: 'billing', title: 'Billing' },
]
const toolbarCss = css({
  display: 'flex',
  gap: '6px',
  padding: '5px',
  borderRadius: '10px',
  background: 'light-dark(#ececf0, #25252b)',
  border: '1px solid light-dark(#e0e0e6, #393940)',
})
const radioCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  flex: 1,
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: '6px',
  color: 'light-dark(#62626c, #b0b0bb)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 160ms ease, color 160ms ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '&:hover': { color: 'light-dark(#202027, #eeeef2)' },
  '&:has(:checked)': {
    background: 'light-dark(#ffffff, #393940)',
    color: 'light-dark(#202027, #eeeef2)',
    boxShadow: '0 1px 3px #00000018',
  },
  '&:has(:focus-visible)': { outline: '2px solid #5bb8ef', outlineOffset: '2px' },
})
const visuallyHiddenCss = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})
const indicatorCss = css({
  flexShrink: 0,
  transition: 'transform 160ms ease',
  '&[data-selected]': { transform: 'rotate(45deg)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}

function PlusIcon(handle: Handle<{ selected: boolean }>) {
  return () => (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      data-selected={handle.props.selected ? '' : undefined}
      mix={indicatorCss}
    >
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  )
}
