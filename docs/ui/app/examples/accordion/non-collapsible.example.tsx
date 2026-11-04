import * as accordion from '@remix-run/ui/accordion'
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

export default function ExampleAccordion() {
  return () => (
    <div mix={styles.root}>
      <accordion.Context defaultValue="shipping" collapsible={false}>
        <div mix={[accordion.root(), styles.accordion]}>
          <Item value="shipping" title="Shipping">
            Standard delivery in 2–4 business days. Tracking is sent when your order ships.
          </Item>
          <Item value="billing" title="Billing">
            Card ending in 4242. Your receipt will be sent to the email on your account.
          </Item>
        </div>
      </accordion.Context>
    </div>
  )
}

const styles = {
  root: css({
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
  }),

  item: css({
    borderTop: '1px solid light-dark(#ebebef, #303037)',
    '&:first-child': {
      borderTop: 0,
    },
  }),

  heading: css({
    margin: 0,
    font: 'inherit',
  }),

  trigger: css({
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
    '&:disabled, &[aria-disabled]': {
      cursor: 'not-allowed',
    },
    '&:hover:not(:disabled):not([aria-disabled])': {
      background: 'light-dark(#f7f7fa, #24242b)',
    },
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '-3px',
    },
    '& svg': {
      opacity: 1,
      transition: 'opacity 120ms ease',
    },
    '&[aria-disabled] svg': {
      opacity: 0,
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& svg': {
        transition: 'none',
      },
    },
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

  contentInner: css({
    minHeight: 0,
    overflow: 'hidden',
  }),

  description: css({
    margin: 0,
    padding: '0 20px 20px',
    color: 'light-dark(#62626c, #b0b0bb)',
  }),
}

function Item(handle: Handle<{ value: string; title: string; children: RemixNode }>) {
  return () => (
    <accordion.ItemContext value={handle.props.value}>
      <div mix={[accordion.item(), styles.item]}>
        <h3 mix={styles.heading}>
          <button type="button" mix={[accordion.trigger(), styles.trigger]}>
            {handle.props.title}
            <ChevronDownIcon />
          </button>
        </h3>
        <div mix={[accordion.content(), styles.content]}>
          <div mix={styles.contentInner}>
            <p mix={styles.description}>{handle.props.children}</p>
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
