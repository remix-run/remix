import type { Handle } from 'remix/component'
import { animateEntrance, animateExit } from 'remix/component'

export function MixinReclaim(handle: Handle) {
  let visible = true
  let interruptTimer: number | undefined

  function clearInterruptTimer() {
    if (interruptTimer === undefined) return
    window.clearTimeout(interruptTimer)
    interruptTimer = undefined
  }

  function scheduleInterrupt() {
    clearInterruptTimer()
    visible = false
    handle.update()
    interruptTimer = window.setTimeout(() => {
      visible = true
      handle.update()
      interruptTimer = undefined
    }, 140)
  }

  return () => (
    <div css={{ display: 'flex', flexDirection: 'column', gap: 12, width: 240 }}>
      <div css={{ display: 'flex', gap: 8 }}>
        <button
          css={{
            flex: 1,
            padding: '8px 10px',
            border: 'none',
            borderRadius: 6,
            backgroundColor: '#10b981',
            color: 'white',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#059669' },
          }}
          on={{
            click() {
              clearInterruptTimer()
              visible = true
              handle.update()
            },
          }}
        >
          Show
        </button>
        <button
          css={{
            flex: 1,
            padding: '8px 10px',
            border: 'none',
            borderRadius: 6,
            backgroundColor: '#f59e0b',
            color: 'white',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#d97706' },
          }}
          on={{
            click: scheduleInterrupt,
          }}
        >
          Interrupt
        </button>
      </div>

      <button
        css={{
          padding: '8px 10px',
          border: 'none',
          borderRadius: 6,
          backgroundColor: '#ef4444',
          color: 'white',
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#dc2626' },
        }}
        on={{
          click() {
            clearInterruptTimer()
            visible = false
            handle.update()
          },
        }}
      >
        Hide
      </button>

      <div css={{ minHeight: 100, display: 'grid', placeItems: 'center' }}>
        {visible && (
          <div
            key="reclaim-card"
            mix={[
              animateEntrance({
                opacity: 0,
                transform: 'translateY(12px) scale(0.94)',
                duration: 260,
                easing: 'ease-out',
              }),
              animateExit({
                opacity: 0,
                transform: 'translateY(-12px) scale(0.94)',
                duration: 260,
                easing: 'ease-in',
              }),
            ]}
            css={{
              width: 200,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              color: 'white',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Reclaim Me Mid-Exit
          </div>
        )}
      </div>
    </div>
  )
}
