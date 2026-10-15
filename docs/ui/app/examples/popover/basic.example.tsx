import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as popover from '@remix-run/ui/popover'

export default function Example(handle: Handle) {
  let open = false
  return () => (
    <div mix={stackCss}>
      <popover.Context>
        <button
          type="button"
          aria-label="Filter pull requests"
          aria-controls={`${handle.id}-surface`}
          aria-expanded={open}
          mix={[
            buttonCss,
            popover.anchor({ placement: 'bottom', offset: 8 }),
            popover.focusOnHide(),
            on('click', () => {
              open = !open
              handle.update()
            }),
          ]}
        >
          <FilterIcon />
        </button>
        <div
          id={`${handle.id}-surface`}
          role="dialog"
          aria-label="Filter pull requests"
          mix={[
            surfaceCss,
            popover.surface({
              open,
              onHide() {
                open = false
                handle.update()
              },
            }),
          ]}
        >
          <fieldset mix={filtersCss}>
            <legend>Status</legend>
            <label mix={checkboxCss}>
              <input
                type="checkbox"
                name="status"
                value="open"
                defaultChecked
                mix={popover.focusOnShow()}
              />
              Open
            </label>
            <label mix={checkboxCss}>
              <input type="checkbox" name="status" value="merged" />
              Merged
            </label>
            <label mix={checkboxCss}>
              <input type="checkbox" name="status" value="closed" />
              Closed
            </label>
          </fieldset>
        </div>
      </popover.Context>
    </div>
  )
}

const stackCss = css({
  colorScheme: 'light dark',
  width: '320px',
  maxWidth: '100%',
  display: 'flex',
  justifyContent: 'center',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const buttonCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  '&:hover': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
})

const surfaceCss = css({
  colorScheme: 'light dark',
  boxSizing: 'border-box',
  margin: 0,
  padding: '12px',
  width: '196px',
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

const filtersCss = css({
  margin: 0,
  padding: 0,
  border: 0,
  '& legend': {
    padding: '0 8px 6px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'light-dark(#62626c, #b0b0bb)',
  },
})

const checkboxCss = css({
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minHeight: '40px',
  padding: '8px',
  borderRadius: '5px',
  fontSize: '13px',
  cursor: 'pointer',
  '&:hover': { background: 'light-dark(#f0f0f5, #303038)' },
  '& input': { margin: 0, width: '16px', height: '16px', accentColor: '#7462e7' },
  '& input:focus-visible': { outline: '2px solid #7462e7', outlineOffset: '3px' },
})

function FilterIcon() {
  return () => (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    >
      <path d="M4 7h16M4 17h16M9 4v6M15 14v6" />
    </svg>
  )
}
