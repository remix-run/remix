import type { Handle } from 'remix/component'
import { spring } from 'remix/component'

export function ExitAnimation(handle: Handle) {
  let isVisible = true

  let shouldAnimate = false
  handle.queueTask(() => {
    shouldAnimate = true
  })

  return () => (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        width: '100px',
        height: '160px',
        position: 'relative',
      }}
    >
      {isVisible && (
        <div
          key="exit-animation"
          css={{
            width: '100px',
            height: '100px',
            backgroundColor: '#0cdcf7',
            borderRadius: '10px',
          }}
          animate={{
            enter: shouldAnimate && {
              opacity: 0,
              transform: 'scale(0)',
              ...spring('snappy'),
            },
            exit: {
              opacity: 0,
              transform: 'scale(0)',
              ...spring(),
            },
          }}
        />
      )}
      <button
        css={{
          backgroundColor: '#0cdcf7',
          borderRadius: '10px',
          padding: '10px 20px',
          color: '#0f1115',
          border: 'none',
          cursor: 'pointer',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transition: `transform 100ms ease-in-out`,
          '&:active': {
            transform: 'translateY(1px)',
          },
        }}
        on={{
          click() {
            isVisible = !isVisible
            handle.update()
          },
        }}
      >
        {isVisible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
