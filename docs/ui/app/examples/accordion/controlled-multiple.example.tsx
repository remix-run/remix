import * as accordion from '@remix-run/ui/accordion'
import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

export default function ExampleAccordion(handle: Handle) {
  let value: string[] = ['shipping']
  return () => (
    <div mix={styles.root}>
      <div role="group" aria-label="Open order sections" mix={styles.toolbar}>
        {sections.map((section) => (
          <button
            key={section.value}
            type="button"
            aria-pressed={value.includes(section.value)}
            mix={[
              on('click', () => {
                value = value.includes(section.value)
                  ? value.filter((item) => item !== section.value)
                  : [...value, section.value]
                handle.update()
              }),
              styles.toggle,
            ]}
          >
            <PlusIcon selected={value.includes(section.value)} />
            {value.includes(section.value) ? 'Hide' : 'Show'} {section.title}
          </button>
        ))}
      </div>
      <accordion.Context
        type="multiple"
        value={value}
        onValueChange={(next) => {
          value = next
          handle.update()
        }}
      >
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
    '--text': 'light-dark(#202027, #eeeef2)',
    '--muted': 'light-dark(#62626c, #b0b0bb)',
    '--border': 'light-dark(#e0e0e6, #393940)',
    '--focus-ring': 'light-dark(#70707c, #a0a0ac)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'grid',
    gap: '16px',
    width: '28rem',
    maxWidth: '100%',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  toolbar: css({
    display: 'flex',
    gap: '6px',
    padding: '5px',
    borderRadius: '10px',
    background: 'light-dark(#ececf0, #25252b)',
    border: '1px solid var(--border)',
  }),

  toggle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    padding: '9px 10px',
    borderRadius: '6px',
    color: 'var(--muted)',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 160ms ease, color 160ms ease',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    border: 0,
    background: 'transparent',
    '&:hover': {
      color: 'var(--text)',
    },
    '&[aria-pressed="true"]': {
      background: 'light-dark(#ffffff, #393940)',
      color: 'var(--text)',
      boxShadow: '0 1px 3px #00000018',
    },
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '2px',
    },
  }),

  accordion: css({
    overflow: 'hidden',
    border: '1px solid var(--border)',
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
    '&:disabled': {
      cursor: 'not-allowed',
    },
    '&:hover:not(:disabled)': {
      background: 'light-dark(#f7f7fa, #24242b)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '-3px',
    },
    '& svg': {
      transition: 'transform 280ms ease',
    },
    '&[data-state="open"] svg': {
      transform: 'rotate(180deg)',
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
    color: 'var(--muted)',
  }),

  indicator: css({
    flexShrink: 0,
    transition: 'transform 160ms ease',
    '&[data-selected]': {
      transform: 'rotate(45deg)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
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

function PlusIcon(handle: Handle<{ selected: boolean }>) {
  return () => (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      data-selected={handle.props.selected ? '' : undefined}
      mix={styles.indicator}
    >
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

const sections = [
  { value: 'shipping', title: 'Shipping' },
  { value: 'billing', title: 'Billing' },
]
