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
          aria-expanded={open}
          aria-controls={`${handle.id}-filters`}
          mix={[
            buttonCss,
            popover.anchor({ placement: 'bottom-start', offset: 8 }),
            popover.focusOnHide(),
            on('click', () => {
              open = !open
              handle.update()
            }),
          ]}
        >
          Filters <ChevronDownIcon />
        </button>
        <div
          id={`${handle.id}-filters`}
          role="dialog"
          aria-label="Project filters"
          mix={[
            surfaceCss,
            filterSurfaceCss,
            popover.surface({
              open,
              onHide() {
                open = false
                handle.update()
              },
            }),
          ]}
        >
          <div mix={filterFieldsCss}>
            <strong>Project filters</strong>
            <label>
              <input type="checkbox" mix={popover.focusOnShow()} /> Assigned to me
            </label>
            <label>
              <input type="checkbox" /> Due this week
            </label>
            <button
              type="button"
              mix={[
                buttonCss,
                on('click', () => {
                  open = false
                  handle.update()
                }),
              ]}
            >
              Done
            </button>
          </div>
        </div>
      </popover.Context>
    </div>
  )
}

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

const filterSurfaceCss = css({ padding: '18px', width: '260px' })

const filterFieldsCss = css({ display: 'grid', gap: '16px' })

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}
