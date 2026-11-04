import * as combobox from '@remix-run/ui/combobox'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleCombobox(handle: Handle) {
  let searchText = ''

  return () => (
    <div mix={styles.root}>
      <combobox.Context>
        <label for={`${handle.id}-font`}>Font</label>
        <input
          id={`${handle.id}-font`}
          placeholder="Search fonts"
          mix={[
            combobox.input(),
            on('input', (event) => {
              searchText = event.currentTarget.value
              handle.update()
            }),
            styles.input,
          ]}
        />
        <div
          mix={[
            combobox.popover(),
            on('beforetoggle', (event) => {
              if (event.newState === 'closed') {
                searchText = ''
              }
            }),
            on('toggle', (event) => {
              if (event.newState === 'open') {
                handle.update()
              }
            }),
            styles.surface,
          ]}
        >
          <div aria-label="Fonts" mix={[combobox.list(), styles.list]}>
            {groups.map((group) => (
              <div
                key={group.id}
                role="group"
                aria-labelledby={`${handle.id}-${group.id}`}
                mix={styles.group}
              >
                <div id={`${handle.id}-${group.id}`} mix={styles.groupLabel}>
                  {group.label}
                </div>
                {group.options.map((option) => (
                  <div key={option.value} mix={[combobox.option(option), styles.option]}>
                    <span>{highlightMatch(option.label, searchText)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <input mix={combobox.hiddenInput()} />
      </combobox.Context>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',
    '--surface': 'light-dark(#fff, #1b1b20)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '320px',
    maxWidth: '100%',
    display: 'grid',
    gap: '16px',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  input: css({
    width: '100%',
    padding: '10px 12px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'var(--surface)',
    color: 'inherit',
    font: 'inherit',
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '2px',
    },
  }),

  surface: css({
    colorScheme: 'light dark',
    margin: 0,
    padding: '6px',
    minWidth: '220px',
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '10px',
    background: 'var(--surface)',
    color: 'var(--text)',
    boxShadow: '0 12px 32px #00000024',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    opacity: 0,
    transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
    '&:popover-open': {
      opacity: 1,
      '@starting-style': {
        opacity: 0,
      },
    },
    '&[data-show-reason="hint"]': {
      transition: 'none',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  list: css({
    display: 'grid',
    gap: '2px',
    maxHeight: '320px',
    overflow: 'auto',
    outline: 0,
  }),

  group: css({
    display: 'grid',
    gap: '2px',
    '&:not(:has([role="option"]:not([hidden])))': {
      display: 'none',
    },
  }),

  groupLabel: css({
    padding: '8px 12px 4px',
    color: 'light-dark(#62626c, #b0b0bb)',
    fontSize: '12px',
    fontWeight: 600,
  }),

  match: css({
    background: 'none',
    color: 'inherit',
    fontWeight: 650,
  }),

  option: css({
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'default',
    '&[hidden]': {
      display: 'none',
    },
    '&[data-highlighted="true"]': {
      background: 'light-dark(#eeeef3, #303038)',
    },
    '&[aria-selected="true"]': {
      background: 'light-dark(#e4e4eb, #3b3b44)',
    },
    '&[data-combobox-flash]': {
      background: 'light-dark(#d6d6e0, #4b4b56)',
    },
  }),
}

function highlightMatch(text: string, searchText: string) {
  let start = text.toLowerCase().indexOf(searchText.toLowerCase())
  if (!searchText || start === -1) {
    return text
  }

  let end = start + searchText.length

  return (
    <>
      {text.slice(0, start)}
      <mark mix={styles.match}>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

const groups = [
  {
    id: 'sans-serif',
    label: 'Sans serif',
    options: [
      { value: 'arial', label: 'Arial' },
      { value: 'avenir', label: 'Avenir' },
      { value: 'helvetica', label: 'Helvetica' },
      { value: 'verdana', label: 'Verdana' },
    ],
  },
  {
    id: 'serif',
    label: 'Serif',
    options: [
      { value: 'georgia', label: 'Georgia' },
      { value: 'palatino', label: 'Palatino' },
      { value: 'times-new-roman', label: 'Times New Roman' },
    ],
  },
  {
    id: 'monospace',
    label: 'Monospace',
    options: [
      { value: 'consolas', label: 'Consolas' },
      { value: 'courier-new', label: 'Courier New' },
      { value: 'menlo', label: 'Menlo' },
      { value: 'monaco', label: 'Monaco' },
    ],
  },
]
