import * as accordion from '@remix-run/ui/accordion'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleAccordion(handle: Handle) {
  return () => (
    <div mix={styles.root}>
      <p id={`${handle.id}-reason`} mix={styles.reason}>
        Sign in to use saved addresses and cards.
      </p>
      <accordion.Context disabled>
        <div mix={[accordion.root(), styles.accordion]}>
          <Item value="addresses" title="Saved addresses" reasonId={`${handle.id}-reason`} />
          <Item value="cards" title="Saved cards" reasonId={`${handle.id}-reason`} />
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
    display: 'grid',
    gap: '16px',
    width: '28rem',
    maxWidth: '100%',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  reason: css({
    margin: 0,
    color: 'var(--muted)',
    fontSize: '13px',
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
    },
    '& p': {
      margin: 0,
      padding: '0 20px 20px',
      color: 'var(--muted)',
    },
  }),

  item: css({
    borderTop: '1px solid light-dark(#ebebef, #303037)',
    '&:first-child': {
      borderTop: 0,
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
}

function Item(handle: Handle<{ value: string; title: string; reasonId: string }>) {
  return () => (
    <accordion.ItemContext value={handle.props.value}>
      <div mix={[accordion.item(), styles.item]}>
        <h3>
          <button type="button" aria-describedby={handle.props.reasonId} mix={accordion.trigger()}>
            {handle.props.title}
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
              {handle.props.value === 'addresses'
                ? 'Choose a saved delivery address.'
                : 'Choose a saved payment card.'}
            </p>
          </div>
        </div>
      </div>
    </accordion.ItemContext>
  )
}
