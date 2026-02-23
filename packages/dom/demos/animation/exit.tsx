import { on, spring } from '@remix-run/dom'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

export function ExitAnimation(handle: DemoHandle, _setup: unknown) {
  let isVisible = true
  let isLeaving = false
  let showKey = 0
  let shouldAnimateEnter = false

  let hide = () => {
    if (!isVisible || isLeaving) return
    isLeaving = true
    void handle.update()
  }

  let show = () => {
    if (isVisible) return
    isVisible = true
    isLeaving = false
    shouldAnimateEnter = true
    showKey++
    void handle.update()
  }

  return () => (
    <div style={{ display: 'flex', flexDirection: 'column', width: 100, height: 160, position: 'relative' }}>
      {isVisible && (
        <div
          key={`exit-animation-${showKey}`}
          mix={[
            on('transitionend', (event) => {
              if (event.propertyName !== 'transform' || !isLeaving) return
              isVisible = false
              isLeaving = false
              shouldAnimateEnter = true
              void handle.update()
            }),
          ].filter(Boolean) as any}
          style={{ width: 100, height: 100, borderRadius: 10, backgroundColor: '#0cdcf7', opacity: isLeaving ? 0 : 1, transform: isLeaving ? 'scale(0)' : 'scale(1)', transition: `transform ${spring()}, opacity ${spring()}` }}
        />
      )}
      <button
        mix={[
          on('click', () => {
            if (isVisible) hide()
            else show()
          }),
        ]}
        style={{ backgroundColor: '#0cdcf7', borderRadius: 10, padding: '10px 20px', color: '#0f1115', border: 'none', cursor: 'pointer', position: 'absolute', bottom: 0, left: 0, right: 0, transition: 'transform 100ms ease-in-out' }}
      >
        {isVisible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
