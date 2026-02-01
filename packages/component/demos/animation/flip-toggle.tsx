import { type Handle } from 'remix/component'

export function FlipToggle(handle: Handle) {
  let isOn = false

  return () => (
    <button
      css={{
        width: 90,
        height: 50,
        backgroundColor: 'rgba(153, 17, 255, 0.2)',
        borderRadius: 50,
        cursor: 'pointer',
        display: 'flex',
        padding: 10,
        border: 'none',
      }}
      style={{
        // The actual layout property that changes
        justifyContent: isOn ? 'flex-start' : 'flex-end',
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
          width: 30,
          height: 30,
          backgroundColor: '#9911ff',
          borderRadius: '50%',
        }}
        animate={{
          layout: {
            duration: 200,
            easing: 'ease-in-out',
          },
        }}
      />
    </button>
  )
}
