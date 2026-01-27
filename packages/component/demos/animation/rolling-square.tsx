import { type Handle } from 'remix/component'
import { spring } from 'remix/component'

export function RollingSquare(handle: Handle) {
  let toggled = false

  return () => (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        minWidth: '300px',
      }}
    >
      <div
        css={{
          width: '80px',
          height: '80px',
          backgroundColor: '#8df0cc',
          borderRadius: '10px',
          transition: `transform ${spring({ duration: 500, bounce: 0.5 })}`,
        }}
        style={{
          transform: toggled ? 'translateX(100%) rotate(180deg)' : 'translateX(-100%)',
        }}
      />
      <button
        css={{
          backgroundColor: '#8df0cc',
          color: '#0f1115',
          borderRadius: '5px',
          padding: '10px',
          margin: '10px',
          border: 'none',
          cursor: 'pointer',
        }}
        on={{
          click() {
            toggled = !toggled
            handle.update()
          },
        }}
      >
        Toggle position
      </button>
    </div>
  )
}
