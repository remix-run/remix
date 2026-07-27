import { css, type Handle } from '@remix-run/ui'
import * as menu from '@remix-run/ui/menu/primitives'

/**
 * @name Menu Primitives
 * @description Headless menu behavior with minimal local styles.
 * @layout center
 */
export default function Example(handle: Handle) {
  let selected = 'none'

  return () => (
    <div
      mix={[
        demoCss,
        menu.onMenuSelect((event) => {
          selected = event.item.name
          void handle.update()
        }),
      ]}
    >
      <menu.Context label="Project actions">
        <button mix={[triggerCss, menu.trigger()]} type="button">
          Actions
        </button>

        <div mix={[surfaceCss, menu.popover()]}>
          <div mix={[listCss, menu.list()]}>
            <div mix={[itemCss, menu.item({ name: 'rename' })]}>Rename</div>
            <div mix={[itemCss, menu.item({ name: 'duplicate' })]}>Duplicate</div>
            <div mix={[itemCss, menu.item({ disabled: true, name: 'archive' })]}>Archive</div>
          </div>
        </div>
      </menu.Context>

      <p mix={valueCss}>{`selected=${selected}`}</p>
    </div>
  )
}

const demoCss = css({
  display: 'grid',
  justifyItems: 'start',
  gap: '8px',
  width: 'min(100%, 16rem)',
})

const triggerCss = css({
  appearance: 'none',
  height: '30px',
  border: '1px solid #cfcfcf',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#101010',
  font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '0 10px',
  '&:focus-visible': {
    outline: '2px solid #3573f6',
    outlineOffset: '2px',
  },
})

const surfaceCss = css({
  boxSizing: 'border-box',
  minWidth: '10rem',
  margin: 0,
  border: '1px solid #cfcfcf',
  borderRadius: '6px',
  background: '#ffffff',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  padding: '4px',
  '&:popover-open': {
    display: 'block',
  },
})

const listCss = css({
  display: 'grid',
  gap: '2px',
  outline: 0,
})

const itemCss = css({
  borderRadius: '4px',
  color: '#101010',
  font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '6px 8px',
  '&[data-highlighted="true"]': {
    background: '#eeeeee',
  },
  '&[data-menu-flash="true"]': {
    background: '#101010',
    color: '#ffffff',
  },
  '&[aria-disabled="true"]': {
    color: '#9a9a9a',
  },
})

const valueCss = css({
  margin: 0,
  color: '#666666',
  font: '500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
})
