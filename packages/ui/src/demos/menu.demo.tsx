import { css, type Handle } from '@remix-run/component'
import * as menu from '@remix-run/ui/menu'

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
        menu.onMenuSelect((event) => {
          selected = event.item.name
          void handle.update()
        }),
        css({
          display: 'grid',
          justifyItems: 'start',
          gap: '8px',
          width: 'min(100%, 16rem)',
        }),
      ]}
    >
      <menu.Context label="Project actions">
        <button
          mix={[
            menu.trigger(),
            css({
              appearance: 'none',
              height: '30px',
              border: '1px solid light-dark(#d1d1d1, #444444)',
              borderRadius: '6px',
              background: 'light-dark(#ffffff, #1a1a1a)',
              color: 'light-dark(#151515, #ececec)',
              font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
              letterSpacing: 0,
              padding: '0 10px',
              '&:focus-visible': {
                outline: '2px solid light-dark(#3573f6, #6eaaff)',
                outlineOffset: '2px',
              },
            }),
          ]}
          type="button"
        >
          Actions
        </button>

        <div
          mix={[
            menu.popover(),
            css({
              boxSizing: 'border-box',
              minWidth: '10rem',
              margin: 0,
              border: '1px solid light-dark(#d1d1d1, #444444)',
              borderRadius: '6px',
              background: 'light-dark(#ffffff, #1a1a1a)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              padding: '4px',
              '&:popover-open': {
                display: 'block',
              },
            }),
          ]}
        >
          <div
            mix={[
              menu.list(),
              css({
                display: 'grid',
                gap: '2px',
                outline: 0,
              }),
            ]}
          >
            <div mix={[menu.item({ name: 'rename' }), itemCss]}>Rename</div>
            <div mix={[menu.item({ name: 'duplicate' }), itemCss]}>Duplicate</div>
            <div mix={[menu.item({ disabled: true, name: 'archive' }), itemCss]}>Archive</div>
          </div>
        </div>
      </menu.Context>

      <p
        mix={css({
          margin: 0,
          color: 'light-dark(#6d6d6d, #b3b3b3)',
          font: '500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        })}
      >{`selected=${selected}`}</p>
    </div>
  )
}

const itemCss = css({
  borderRadius: '4px',
  color: 'light-dark(#151515, #ececec)',
  font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: '6px 8px',
  '&[data-highlighted="true"]': {
    background: 'light-dark(#eeeeee, #2c2c2c)',
  },
  '&[data-menu-flash="true"]': {
    background: 'light-dark(#101010, #ececec)',
    color: 'light-dark(#ffffff, #151515)',
  },
  '&[aria-disabled="true"]': {
    color: 'light-dark(#9a9a9a, #666666)',
  },
})
