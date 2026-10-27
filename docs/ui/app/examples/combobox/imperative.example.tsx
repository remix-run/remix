import * as combobox from '@remix-run/ui/combobox'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleCombobox(handle: Handle) {
  let searchText = ''

  let control: combobox.ComboboxHandle | undefined

  return () => (
    <div mix={styles.root}>
      <combobox.Context
        ref={(comboboxHandle) => {
          control = comboboxHandle
        }}
      >
        <label for={`${handle.id}-state`}>State</label>
        <input
          id={`${handle.id}-state`}
          placeholder="Search states"
          mix={[
            combobox.input(),
            on('input', (event) => {
              searchText = event.currentTarget.value
              handle.update()
            }),
            styles.input,
          ]}
        />
        <button
          type="button"
          mix={[
            on('click', () => {
              void control?.open('first')
            }),
            styles.button,
          ]}
        >
          Browse states
        </button>
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
          <div aria-label="US states" mix={[combobox.list(), styles.list]}>
            {options.map((option) => (
              <div key={option.value} mix={[combobox.option(option), styles.option]}>
                <span>{highlightMatch(option.label, searchText)}</span>
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
    '--control-border': 'light-dark(#d8d8df, #44444c)',
    '--focus-ring': 'light-dark(#70707c, #a0a0ac)',

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
    border: '1px solid var(--control-border)',
    borderRadius: '8px',
    background: 'var(--surface)',
    color: 'inherit',
    font: 'inherit',
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '2px',
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  }),

  button: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '9px 14px',
    border: '1px solid var(--control-border)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #25252b)',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover:not(:disabled)': {
      background: 'light-dark(#f0f0f5, #303038)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '3px',
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
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
    maxHeight: '240px',
    overflow: 'auto',
    outline: 0,
  }),

  match: css({
    background: 'none',
    color: 'inherit',
    fontWeight: 650,
  }),

  option: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
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
    '&[aria-disabled="true"]': {
      opacity: 0.4,
      cursor: 'not-allowed',
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

const options = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]
