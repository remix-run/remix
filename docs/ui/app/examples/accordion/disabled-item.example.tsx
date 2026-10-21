import * as accordion from '@remix-run/ui/accordion'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleAccordion() {
  return () => (
    <div mix={styles.root}>
      <accordion.Context defaultValue="shipping">
        <div mix={[accordion.root(), styles.accordion]}>
          <Item value="shipping" title="Shipping" />
          <Item value="gift-wrapping" title="Gift wrapping" disabled />
          <Item value="billing" title="Billing" />
        </div>
      </accordion.Context>
    </div>
  )
}

const styles = {
  root: css({
    '--muted': 'light-dark(#62626c, #b0b0bb)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '28rem',
    maxWidth: '100%',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  accordion: css({
    overflow: 'hidden',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    '& h3': {
      margin: 0,
      font: 'inherit',
    },
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
      '&:disabled': {
        color: 'light-dark(#94949f, #72727e)',
        cursor: 'not-allowed',
      },
      '&:hover:not(:disabled)': {
        background: 'light-dark(#f7f7fa, #24242b)',
      },
      '&:focus-visible': {
        outline: '2px solid light-dark(#70707c, #a0a0ac)',
        outlineOffset: '-3px',
      },
      '& svg': {
        transition: 'transform 280ms ease',
      },
      '&[data-state="open"] svg': {
        transform: 'rotate(180deg)',
      },
    },
    '& p': {
      margin: 0,
      padding: '0 20px 20px',
      color: 'var(--muted)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& button svg': {
        transition: 'none',
      },
    },
  }),

  item: css({
    borderTop: '1px solid light-dark(#ebebef, #303037)',
    '&:first-child': {
      borderTop: 0,
    },
  }),

  reason: css({
    display: 'block',
    marginTop: '2px',
    fontSize: '12px',
    fontWeight: 400,
    color: 'var(--muted)',
  }),

  content: css({
    display: 'grid',
    gridTemplateRows: '0fr',
    opacity: 0,
    transition: 'grid-template-rows 280ms ease, opacity 200ms ease',
    '&[data-state="open"]': {
      gridTemplateRows: '1fr',
      opacity: 1,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),
}

function Item(handle: Handle<{ value: string; title: string; disabled?: boolean }>) {
  return () => (
    <accordion.ItemContext value={handle.props.value} disabled={handle.props.disabled}>
      <div mix={[accordion.item(), styles.item]}>
        <h3>
          <button type="button" mix={accordion.trigger()}>
            <span>
              {handle.props.title}
              {handle.props.disabled && (
                <span mix={styles.reason}>Unavailable for oversized items</span>
              )}
            </span>
            {!handle.props.disabled && <ChevronDownIcon />}
          </button>
        </h3>
        <div mix={[accordion.content(), styles.content]}>
          <div
            mix={css({
              minHeight: 0,
              overflow: 'hidden',
            })}
          >
            <p>
              {handle.props.value === 'shipping'
                ? 'Standard delivery in 2–4 business days. Tracking is sent when your order ships.'
                : handle.props.value === 'billing'
                  ? 'Card ending in 4242. Your receipt will be sent to the email on your account.'
                  : 'Add gift wrapping to your order.'}
            </p>
          </div>
        </div>
      </div>
    </accordion.ItemContext>
  )
}

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}
