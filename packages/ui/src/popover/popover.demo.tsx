import { css, on, type Handle } from '@remix-run/ui'
import button from '@remix-run/ui/button'
import * as popover from '@remix-run/ui/popover'

/**
 * @name Popover
 * @description Anchored popover behavior with focus restoration and outside-click dismissal.
 * @layout center
 */
export default function Example(handle: Handle) {
  let open = false

  function setOpen(nextOpen: boolean) {
    open = nextOpen
    void handle.update()
  }

  return () => (
    <popover.Context>
      <div mix={demoCss}>
        <button
          mix={[
            button(),
            popover.anchor({ placement: 'bottom-start', offset: 8 }),
            popover.focusOnHide(),
            on('click', () => {
              setOpen(!open)
            }),
          ]}
        >
          View options
        </button>

        <div
          mix={[
            surfaceCss,
            popover.surface({
              open,
              onHide() {
                setOpen(false)
              },
            }),
          ]}
        >
          <button
            mix={[
              button({ tone: 'ghost' }),
              popover.focusOnShow(),
              on('click', () => {
                setOpen(false)
              }),
            ]}
          >
            Close
          </button>
          <div mix={surfaceBodyCss}>Popover content stays app-owned.</div>
        </div>
      </div>
    </popover.Context>
  )
}

const demoCss = css({
  display: 'grid',
  placeItems: 'center',
  minHeight: '10rem',
  width: 'min(100%, 24rem)',
})

const surfaceCss = css({
  boxSizing: 'border-box',
  width: '14rem',
  margin: 0,
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '8px',
  background: 'light-dark(#ffffff, #1a1a1a)',
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.14)',
  color: 'light-dark(#151515, #ececec)',
  padding: '8px',
  '&:popover-open': {
    display: 'grid',
    gap: '8px',
  },
})

const surfaceBodyCss = css({
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 500,
  letterSpacing: 0,
  color: 'light-dark(#4f4f4f, #b3b3b3)',
  padding: '2px 4px 4px',
})
