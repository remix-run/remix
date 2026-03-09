import { animateLayout, css, on, type Handle } from 'remix/component'

export function FlipToggle(handle: Handle) {
  let isOn = false

  return () => (
    <button
      mix={[
        css({
          width: 90,
          height: 50,
          backgroundColor: 'rgba(153, 17, 255, 0.2)',
          borderRadius: 50,
          cursor: 'pointer',
          display: 'flex',
          padding: 10,
          border: 'none',
        }),
        on('click', () => {
          isOn = !isOn
          handle.update()
        }),
      ]}
      style={{
        // The actual layout property that changes
        justifyContent: isOn ? 'flex-start' : 'flex-end',
      }}
    >
      <div
        mix={[
          css({
            width: 30,
            height: 30,
            backgroundColor: '#9911ff',
            borderRadius: '50%',
          }),
          animateLayout({
            duration: 200,
            easing: 'ease-in-out',
          }),
        ]}
      />
    </button>
  )
}
