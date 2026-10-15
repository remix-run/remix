import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as combobox from '@remix-run/ui/combobox'

export default function Example(handle: Handle) {
  return () => (
    <div mix={stackCss}>
      <combobox.Context>
        <label for={`${handle.id}-airport`}>Destination airport</label>
        <input
          id={`${handle.id}-airport`}
          placeholder="Search cities or airport codes"
          mix={[inputCss, combobox.input()]}
        />
        <div mix={[surfaceCss, combobox.popover()]}>
          <div aria-label="Destination airports" mix={[listCss, combobox.list()]}>
            {options.map((option) => (
              <div key={option.value} mix={[optionCss, combobox.option(option)]}>
                <span>
                  <strong>{option.label}</strong>
                  <p mix={mutedCss}>
                    {option.detail}
                    {option.disabled ? ' · No available flights' : ''}
                  </p>
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
const options = [
  {
    value: 'ATL',
    label: 'Atlanta (ATL)',
    detail: 'Hartsfield-Jackson',
    searchValue: ['Atlanta (ATL)', 'ATL', 'Georgia'],
  },
  {
    value: 'BOS',
    label: 'Boston (BOS)',
    detail: 'Logan International',
    searchValue: ['Boston (BOS)', 'BOS', 'Massachusetts'],
  },
  {
    value: 'ORD',
    label: 'Chicago (ORD)',
    detail: "O'Hare International",
    searchValue: ['Chicago (ORD)', 'ORD', 'Illinois'],
  },
  {
    value: 'DFW',
    label: 'Dallas (DFW)',
    detail: 'Dallas Fort Worth',
    searchValue: ['Dallas (DFW)', 'DFW', 'Texas'],
  },
  {
    value: 'DEN',
    label: 'Denver (DEN)',
    detail: 'Denver International',
    searchValue: ['Denver (DEN)', 'DEN', 'Colorado'],
  },
  {
    value: 'LAX',
    label: 'Los Angeles (LAX)',
    detail: 'Los Angeles International',
    searchValue: ['Los Angeles (LAX)', 'LAX', 'California'],
  },
  {
    value: 'MIA',
    label: 'Miami (MIA)',
    detail: 'Miami International',
    searchValue: ['Miami (MIA)', 'MIA', 'Florida'],
  },
  {
    value: 'JFK',
    label: 'New York (JFK)',
    detail: 'John F. Kennedy',
    searchValue: ['New York (JFK)', 'JFK', 'New York'],
  },
  {
    value: 'EWR',
    label: 'Newark (EWR)',
    detail: 'Newark Liberty',
    searchValue: ['Newark (EWR)', 'EWR', 'New Jersey'],
    disabled: true,
  },
  {
    value: 'PHX',
    label: 'Phoenix (PHX)',
    detail: 'Sky Harbor',
    searchValue: ['Phoenix (PHX)', 'PHX', 'Arizona'],
  },
  {
    value: 'SFO',
    label: 'San Francisco (SFO)',
    detail: 'San Francisco International',
    searchValue: ['San Francisco (SFO)', 'SFO', 'California'],
  },
  {
    value: 'SEA',
    label: 'Seattle (SEA)',
    detail: 'Seattle-Tacoma',
    searchValue: ['Seattle (SEA)', 'SEA', 'Washington'],
  },
]

const stackCss = css({
  colorScheme: 'light dark',
  width: '320px',
  maxWidth: '100%',
  display: 'grid',
  gap: '16px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const mutedCss = css({ margin: 0, fontSize: '12px', color: 'light-dark(#62626c, #b0b0bb)' })

const inputCss = css({
  boxSizing: 'border-box',
  width: '100%',
  padding: '10px 12px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'inherit',
  font: 'inherit',
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '2px' },
  '&:disabled': { opacity: 0.45 },
})

const surfaceCss = css({
  colorScheme: 'light dark',
  boxSizing: 'border-box',
  margin: 0,
  padding: '6px',
  minWidth: '220px',
  maxWidth: 'calc(100vw - 32px)',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '10px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'light-dark(#202027, #eeeef2)',
  boxShadow: '0 12px 32px #00000024',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  opacity: 0,
  transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
  '&:popover-open': { opacity: 1, '@starting-style': { opacity: 0 } },
  '&[data-show-reason="hint"]': { transition: 'none' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

const listCss = css({
  display: 'grid',
  gap: '2px',
  maxHeight: '240px',
  overflow: 'auto',
  outline: 0,
})

const optionCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 12px',
  borderRadius: '6px',
  cursor: 'default',
  '&[hidden]': { display: 'none' },
  '&[data-highlighted="true"]': { background: 'light-dark(#eeeef3, #303038)' },
  '&[aria-selected="true"]': {
    color: 'light-dark(#0578be, #80caff)',
    background: 'light-dark(#eaf5fc, #173348)',
  },
  '&[aria-disabled="true"]': { opacity: 0.4 },
  '&[data-combobox-flash]': {
    background: 'light-dark(#0578be, #80caff)',
    color: 'light-dark(#fff, #102332)',
  },
})
