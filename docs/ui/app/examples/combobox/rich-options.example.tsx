import * as combobox from '@remix-run/ui/combobox'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleCombobox(handle: Handle) {
  let searchText = ''

  return () => (
    <div mix={styles.root}>
      <combobox.Context>
        <div mix={styles.field}>
          <label for={`${handle.id}-airport`}>Destination airport</label>
          <input
            id={`${handle.id}-airport`}
            aria-describedby={`${handle.id}-airport-help`}
            mix={[
              combobox.input(),
              on('input', (event) => {
                searchText = event.currentTarget.value
                handle.update()
              }),
              styles.input,
            ]}
          />
          <p id={`${handle.id}-airport-help`} mix={styles.help}>
            Search by city, airport name, or code.
          </p>
        </div>
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
          <div aria-label="Destination airports" mix={[combobox.list(), styles.list]}>
            {options.map((option) => (
              <div key={option.value} mix={[combobox.option(option), styles.option]}>
                <span>
                  <span>{highlightMatch(option.label, searchText)}</span>
                  <span mix={styles.muted}>
                    {highlightMatch(option.detail, searchText)}
                    {option.disabled ? ' · No available flights' : ''}
                  </span>
                </span>
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

  field: css({
    display: 'grid',
    gap: '8px',
  }),

  help: css({
    margin: 0,
    color: 'light-dark(#62626c, #b0b0bb)',
    fontSize: '12px',
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
      color: 'light-dark(#94949f, #72727e)',
      cursor: 'not-allowed',
    },
    '&[data-combobox-flash]': {
      background: 'light-dark(#d6d6e0, #4b4b56)',
    },
  }),

  muted: css({
    display: 'block',
    fontSize: '12px',
    color: 'light-dark(#62626c, #b0b0bb)',
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
  {
    value: 'ATL',
    label: 'Atlanta (ATL)',
    detail: 'Hartsfield-Jackson',
    searchValue: ['Atlanta (ATL)', 'ATL', 'Georgia', 'Hartsfield-Jackson'],
  },
  {
    value: 'BOS',
    label: 'Boston (BOS)',
    detail: 'Logan International',
    searchValue: ['Boston (BOS)', 'BOS', 'Massachusetts', 'Logan International'],
  },
  {
    value: 'ORD',
    label: 'Chicago (ORD)',
    detail: "O'Hare International",
    searchValue: ['Chicago (ORD)', 'ORD', 'Illinois', "O'Hare International"],
  },
  {
    value: 'DFW',
    label: 'Dallas (DFW)',
    detail: 'Dallas Fort Worth',
    searchValue: ['Dallas (DFW)', 'DFW', 'Texas', 'Dallas Fort Worth'],
  },
  {
    value: 'DEN',
    label: 'Denver (DEN)',
    detail: 'Denver International',
    searchValue: ['Denver (DEN)', 'DEN', 'Colorado', 'Denver International'],
  },
  {
    value: 'LAX',
    label: 'Los Angeles (LAX)',
    detail: 'Los Angeles International',
    searchValue: ['Los Angeles (LAX)', 'LAX', 'California', 'Los Angeles International'],
  },
  {
    value: 'MIA',
    label: 'Miami (MIA)',
    detail: 'Miami International',
    searchValue: ['Miami (MIA)', 'MIA', 'Florida', 'Miami International'],
  },
  {
    value: 'JFK',
    label: 'New York (JFK)',
    detail: 'John F. Kennedy',
    searchValue: ['New York (JFK)', 'JFK', 'New York', 'John F. Kennedy'],
  },
  {
    value: 'EWR',
    label: 'Newark (EWR)',
    detail: 'Newark Liberty',
    searchValue: ['Newark (EWR)', 'EWR', 'New Jersey', 'Newark Liberty'],
    disabled: true,
  },
  {
    value: 'PHX',
    label: 'Phoenix (PHX)',
    detail: 'Sky Harbor',
    searchValue: ['Phoenix (PHX)', 'PHX', 'Arizona', 'Sky Harbor'],
  },
  {
    value: 'SFO',
    label: 'San Francisco (SFO)',
    detail: 'San Francisco International',
    searchValue: ['San Francisco (SFO)', 'SFO', 'California', 'San Francisco International'],
  },
  {
    value: 'SEA',
    label: 'Seattle (SEA)',
    detail: 'Seattle-Tacoma',
    searchValue: ['Seattle (SEA)', 'SEA', 'Washington', 'Seattle-Tacoma'],
  },
]
