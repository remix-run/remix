import { css, ref } from '@remix-run/ui'
import { anchor } from '@remix-run/ui/anchor'
import button from '@remix-run/ui/button'

/**
 * @name Anchor
 * @description Position a floating element against an anchor with the low-level anchor primitive.
 * @layout center
 */
export default function Example() {
  let anchorNode: HTMLElement | null = null
  let floatingNode: HTMLElement | null = null
  let cleanupAnchor = () => {}

  function positionFloating() {
    cleanupAnchor()

    if (anchorNode && floatingNode) {
      cleanupAnchor = anchor(floatingNode, anchorNode, {
        placement: 'bottom-start',
        offset: 8,
      })
    }
  }

  function clearFloating() {
    cleanupAnchor()
    cleanupAnchor = () => {}
  }

  return () => (
    <div mix={demoCss}>
      <button
        mix={[
          button(),
          ref((node, signal) => {
            if (!(node instanceof HTMLElement)) return

            anchorNode = node
            positionFloating()

            signal.addEventListener('abort', () => {
              if (anchorNode === node) {
                anchorNode = null
              }

              clearFloating()
            })
          }),
        ]}
      >
        Anchor target
      </button>

      <div
        mix={[
          floatingCss,
          ref((node, signal) => {
            if (!(node instanceof HTMLElement)) return

            floatingNode = node
            positionFloating()

            signal.addEventListener('abort', () => {
              if (floatingNode === node) {
                floatingNode = null
              }

              clearFloating()
            })
          }),
        ]}
      >
        Positioned surface
      </div>
    </div>
  )
}

const demoCss = css({
  display: 'grid',
  placeItems: 'center',
  minHeight: '9rem',
  width: 'min(100%, 24rem)',
})

const floatingCss = css({
  boxSizing: 'border-box',
  width: '12rem',
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '8px',
  background: 'light-dark(#ffffff, #1a1a1a)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
  color: 'light-dark(#151515, #ececec)',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 500,
  letterSpacing: 0,
  padding: '10px 12px',
})
