import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import * as menu from '@remix-run/ui/menu'

export default function Example(handle: Handle) {
  let sort = 'recent'
  return () => (
    <div
      mix={[
        stackCss,
        menu.onMenuSelect((event) => {
          if (event.item.name === 'sort' && event.item.value) {
            sort = event.item.value
            handle.update()
          }
        }),
      ]}
    >
      <div mix={cardCss}>
        <menu.Context label="Sort projects">
          <button type="button" mix={[buttonCss, menu.trigger({ offset: 8 })]}>
            Sort projects <ChevronDownIcon />
          </button>
          <div mix={[surfaceCss, menu.popover()]}>
            <div mix={[listCss, menu.list()]}>
              <div role="group" aria-label="Sort order">
                {sortOptions.map((option) => (
                  <div
                    key={option.value}
                    mix={[
                      itemCss,
                      menu.item({
                        name: 'sort',
                        value: option.value,
                        type: 'radio',
                        checked: sort === option.value,
                      }),
                    ]}
                  >
                    {option.label}
                    <span aria-hidden="true" mix={css({ opacity: sort === option.value ? 1 : 0 })}>
                      <CheckIcon />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </menu.Context>
        {(sort === 'name' ? [...projects].sort() : projects).map((project) => (
          <div key={project}>{project}</div>
        ))}
      </div>
    </div>
  )
}
const sortOptions = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'name', label: 'Name' },
]
const projects = ['Website refresh', 'Design system', 'Mobile app']

const stackCss = css({
  colorScheme: 'light dark',
  width: '320px',
  maxWidth: '100%',
  display: 'grid',
  gap: '16px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const cardCss = css({
  padding: '20px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
  display: 'grid',
  gap: '16px',
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
  '&[data-close-animation="none"]': { transition: 'none' },
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

const itemCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '20px',
  padding: '9px 12px',
  borderRadius: '6px',
  outline: 0,
  cursor: 'default',
  '&[data-highlighted="true"]': { background: 'light-dark(#eeeef3, #303038)' },
  '&[data-menu-flash="true"]': {
    background: 'light-dark(#0578be, #80caff)',
    color: 'light-dark(#fff, #102332)',
  },
  '&[aria-disabled="true"]': { opacity: 0.4 },
})

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}
function CheckIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path
        d="m5 12 4 4L19 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
