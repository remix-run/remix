import { on } from '@remix-run/dom/spa'
import { animateEntrance } from '@remix-run/dom/animate-entrance'
import { animateExit } from '@remix-run/dom/animate-exit'
import { spring } from '@remix-run/dom/spring'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

export function ExitAnimation(handle: DemoHandle, _setup: unknown) {
  let isVisible = true
  let presenceSpring = spring('snappy')

  return () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 100,
        height: 160,
        position: 'relative',
      }}
    >
      {isVisible && (
        <div
          key="exit-animation"
          mix={[
            animateEntrance({
              initial: false,
              keyframes: { opacity: 0, transform: 'scale(0.85)' },
              options: {
                duration: presenceSpring.duration,
                easing: presenceSpring.easing,
              },
            }),
            animateExit({
              keyframes: { opacity: 0, transform: 'scale(0.85)' },
              options: {
                duration: presenceSpring.duration,
                easing: presenceSpring.easing,
              },
            }),
          ]}
          style={{
            width: 100,
            height: 100,
            borderRadius: 10,
            backgroundColor: '#0cdcf7',
          }}
        />
      )}
      <button
        mix={[
          on('click', () => {
            if (isVisible) {
              isVisible = false
              void handle.update()
              return
            }
            isVisible = true
            void handle.update()
          }),
        ]}
        style={{
          backgroundColor: '#0cdcf7',
          borderRadius: 10,
          padding: '10px 20px',
          color: '#0f1115',
          border: 'none',
          cursor: 'pointer',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transition: 'transform 100ms ease-in-out',
        }}
      >
        {isVisible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
