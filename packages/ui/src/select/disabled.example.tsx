import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as select from '@remix-run/ui/select'
import * as popover from '@remix-run/ui/popover'
export default function Example() {
  return () => (
    <div mix={stackCss}>
      <select.Context defaultLabel="Standard delivery" defaultValue="standard" disabled>
        <button
          type="button"
          aria-label="Delivery method"
          mix={[buttonCss, triggerLayoutCss, select.trigger()]}
        >
          <SelectedLabel />
          <ChevronDownIcon />
        </button>
        <popover.Context>
          <div mix={[surfaceCss, select.popover()]}>
            <div aria-label="Delivery methods" mix={[listCss, select.list()]}>
              {options.map((option) => (
                <div key={option.value} mix={[optionCss, select.option(option)]}>
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        </popover.Context>
        <input mix={select.hiddenInput()} />
      </select.Context>
    </div>
  )
}
const options = [
  { label: 'Standard delivery', value: 'standard' },
  { label: 'Express delivery', value: 'express' },
  { label: 'Collect in store', value: 'collect' },
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

const buttonCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '9px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
  '&:disabled': { opacity: 0.45, cursor: 'default' },
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
  '&[data-select-flash]': {
    background: 'light-dark(#0578be, #80caff)',
    color: 'light-dark(#fff, #102332)',
  },
})

const triggerLayoutCss = css({ justifyContent: 'space-between', width: '100%' })

function SelectedLabel(handle: Handle) {
  let context = handle.context.get(select.Context)
  return () => <span>{context.displayedLabel}</span>
}
function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}
