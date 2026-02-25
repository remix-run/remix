import { on } from '@remix-run/dom/spa'
import { spring } from '@remix-run/dom/spring'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

export function RollingSquare(handle: DemoHandle, _setup: unknown) {
  let toggled = false
  return () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        minWidth: 300,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 10,
          backgroundColor: '#8df0cc',
          transition: `transform ${spring({ duration: 500, bounce: 0.5 })}`,
          transform: toggled ? 'translateX(100%) rotate(180deg)' : 'translateX(-100%)',
        }}
      />
      <button
        mix={[
          on('click', () => {
            toggled = !toggled
            void handle.update()
          }),
        ]}
        style={{
          backgroundColor: '#8df0cc',
          color: '#0f1115',
          borderRadius: 5,
          padding: '10px 14px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Toggle position
      </button>
    </div>
  )
}
