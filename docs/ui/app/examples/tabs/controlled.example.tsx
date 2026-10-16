import * as tabs from '@remix-run/ui/tabs'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleTabs(handle: Handle) {
  let activeTab = 'details'
  return () => (
    <div mix={styles.root}>
      <tabs.Context
        activeTab={activeTab}
        onActiveTabChange={(next) => {
          activeTab = next
          handle.update()
        }}
      >
        <div mix={[styles.card, tabs.root()]}>
          <div aria-label="File information" mix={[styles.tabList, tabs.list()]}>
            <button
              type="button"
              mix={[
                styles.tab,
                tabs.tab({
                  name: 'details',
                }),
              ]}
            >
              Details
            </button>
            <button
              type="button"
              mix={[
                styles.tab,
                tabs.tab({
                  name: 'version',
                }),
              ]}
            >
              Version
            </button>
          </div>
          <div
            mix={[
              styles.panel,
              tabs.panel({
                name: 'details',
              }),
            ]}
          >
            <dl mix={styles.details}>
              <dt>File</dt>
              <dd>report.pdf</dd>
              <dt>Size</dt>
              <dd>240 KB</dd>
            </dl>
          </div>
          <div
            mix={[
              styles.panel,
              tabs.panel({
                name: 'version',
              }),
            ]}
          >
            <dl mix={styles.details}>
              <dt>Version</dt>
              <dd>2</dd>
              <dt>Author</dt>
              <dd>Alex Morgan</dd>
            </dl>
          </div>
        </div>
      </tabs.Context>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',
    '--muted': 'light-dark(#62626c, #b0b0bb)',
    '--surface': 'light-dark(#fff, #1b1b20)',
    '--border': 'light-dark(#e0e0e6, #393940)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '320px',
    maxWidth: '100%',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  card: css({
    overflow: 'hidden',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'var(--surface)',
  }),

  tabList: css({
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    background: 'light-dark(#f6f6f9, #25252b)',
  }),

  tab: css({
    flex: 1,
    minWidth: 0,
    padding: '14px 12px',
    border: 0,
    background: 'transparent',
    color: 'var(--text)',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    '@media (hover: hover)': {
      '&:not(:disabled):not([data-state="active"]):hover': {
        background: 'light-dark(#eeeef3, #303038)',
      },
    },
    '&:not(:disabled):active': {
      background: 'light-dark(#e6e6ed, #393940)',
    },
    '&[data-state="active"]': {
      background: 'var(--surface)',
      color: 'var(--text)',
      boxShadow: 'inset 0 -1px var(--muted)',
    },
    '&:focus-visible': {
      outline: '2px solid #5bb8ef',
      outlineOffset: '-4px',
    },
    '&:disabled': {
      color: 'light-dark(#94949f, #72727e)',
      cursor: 'not-allowed',
    },
  }),

  panel: css({
    padding: '24px',
    '&[hidden]': {
      display: 'none',
    },
  }),

  details: css({
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '8px 24px',
    margin: 0,
    '& dt': {
      color: 'var(--muted)',
    },
    '& dd': {
      margin: 0,
    },
  }),
}
