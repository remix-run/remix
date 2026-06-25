import { css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { spring } from 'remix/ui/animation'

export function BouncySwitchDemo(handle: Handle) {
  let isOn = true

  return () => (
    <button
      aria-pressed={isOn}
      mix={[
        switchStyles,
        on('click', () => {
          isOn = !isOn
          handle.update()
        }),
      ]}
      type="button"
    >
      <span
        mix={thumbStyles}
        style={{
          transform: isOn ? 'translateY(-100px)' : 'translateY(0)',
          transition: isOn ? `transform ${spring()}` : `transform 800ms ${bounceEasing}`,
        }}
      />
    </button>
  )
}

const bounceEasing = `linear(0, 0.258 12%, 0.424 18.3%, 0.633 24.4%, 0.999 33.3%, 0.783 39.8%, 0.733 42.5%, 0.716 45.1%, 0.731 47.6%, 0.777 50.2%, 0.999 57.7%, 0.906 61.7%, 0.883 63.5%, 0.876 65.2%, 0.901 68.7%, 0.999 74.5%, 0.964 77.4%, 0.953 80.1%, 0.961 82.6%, 1 88.2%, 0.99 91.9%, 1)`

const switchStyles = css({
  display: 'flex',
  width: 80,
  height: 180,
  flexDirection: 'column',
  justifyContent: 'flex-end',
  border: 0,
  borderRadius: 50,
  backgroundColor: '#ff6b35',
  cursor: 'pointer',
  padding: 10,
})

const thumbStyles = css({
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: 'white',
  willChange: 'transform',
})
