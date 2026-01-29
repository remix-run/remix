import type { Handle } from 'remix/component'
import { pressDown, pressUp, pressCancel } from 'remix/interaction/press'

type Ripple = {
  id: number
  x: number
  y: number
  size: number
}

export function MaterialRipple(handle: Handle) {
  let ripples: Ripple[] = []
  let idCounter = 0
  let buttonEl: HTMLButtonElement | null = null

  function createRipple(originX: number, originY: number) {
    if (!buttonEl) return

    let rect = buttonEl.getBoundingClientRect()
    let localX = originX - rect.left
    let localY = originY - rect.top
    let dx = Math.max(localX, rect.width - localX)
    let dy = Math.max(localY, rect.height - localY)
    let radius = Math.sqrt(dx * dx + dy * dy)
    let size = radius * 2

    let id = ++idCounter
    ripples = [...ripples, { id, x: localX, y: localY, size }]
    handle.update()
  }

  function removeAllRipples() {
    if (ripples.length > 0) {
      ripples = []
      handle.update()
    }
  }

  return () => (
    <button
      connect={(el) => {
        buttonEl = el
      }}
      css={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 20px',
        borderRadius: 4,
        textTransform: 'uppercase',
        backgroundColor: 'transparent',
        color: '#7c3aed',
        border: '1px solid #7c3aed',
        userSelect: 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        letterSpacing: '0.2px',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 200ms linear, background-color 200ms linear',
        '&:hover': {
          borderColor: '#6d28d9',
          backgroundColor: '#7c3aed20',
        },
        '&:focus-visible': {
          outline: '2px solid #7c3aed80',
          outlineOffset: 2,
        },
      }}
      on={{
        [pressDown](event) {
          if (!buttonEl) return
          let rect = buttonEl.getBoundingClientRect()
          let x = event.clientX || rect.left + rect.width / 2
          let y = event.clientY || rect.top + rect.height / 2
          createRipple(x, y)
        },
        [pressUp]: removeAllRipples,
        [pressCancel]: removeAllRipples,
      }}
    >
      Click me
      <span
        aria-hidden="true"
        css={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: 'inherit',
          pointerEvents: 'none',
        }}
      >
        {ripples.map((ripple) => (
          // Outer span: handles exit (fade out)
          <span
            key={ripple.id}
            css={{
              position: 'absolute',
              borderRadius: '50%',
            }}
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x - ripple.size / 2,
              top: ripple.y - ripple.size / 2,
            }}
            animate={{
              exit: {
                opacity: 0,
                duration: 550,
                easing: 'ease-out',
              },
            }}
          >
            {/* Inner span: handles enter (scale) so it doesn't get reversed when removed */}
            <span
              css={{
                display: 'block',
                width: '100%',
                height: '100%',
                borderRadius: 'inherit',
                backgroundColor: 'currentColor',
                opacity: 0.4,
              }}
              animate={{
                enter: {
                  opacity: 0,
                  transform: 'scale(0)',
                  duration: 300,
                  easing: 'ease-out',
                },
              }}
            />
          </span>
        ))}
      </span>
    </button>
  )
}
