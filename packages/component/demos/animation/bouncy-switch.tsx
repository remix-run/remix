import { type Handle } from 'remix/component'
import { spring } from 'remix/component'

let bounceEasing = `linear(0, 0.258 12%, 0.424 18.3%, 0.633 24.4%, 0.999 33.3%, 0.783 39.8%, 0.733 42.5%, 0.716 45.1%, 0.731 47.6%, 0.777 50.2%, 0.999 57.7%, 0.906 61.7%, 0.883 63.5%, 0.876 65.2%, 0.901 68.7%, 0.999 74.5%, 0.964 77.4%, 0.953 80.1%, 0.961 82.6%, 1 88.2%, 0.99 91.9%, 1)`

export function BouncySwitch(handle: Handle) {
  let isOn = true

  return () => (
    <div
      css={{
        height: 160,
        backgroundColor: '#ff6b35',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        borderRadius: 50,
        padding: 10,
        cursor: 'pointer',
      }}
      on={{
        click() {
          isOn = !isOn
          handle.update()
        },
      }}
    >
      <div
        css={{
          width: 60,
          height: 60,
          backgroundColor: 'white',
          borderRadius: 30,
          willChange: 'transform',
        }}
        style={{
          transform: isOn ? 'translateY(-100px)' : 'translateY(0)',
          transition: isOn ? `transform ${spring()}` : `transform 800ms ${bounceEasing}`,
        }}
      />
    </div>
  )
}
