import { clientEntry, css, on, type Handle } from 'remix/component'

export let ReloadScope = clientEntry(
  '/assets/reload-scope.js#ReloadScope',
  function ReloadScope(handle: Handle) {
    let framePending = false
    let topPending = false

    return () => (
      <div mix={[css({ display: 'flex', gap: 8, flexWrap: 'wrap' })]}>
        <button
          type="button"
          mix={[
            css({
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: framePending ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
              color: '#e9eefc',
              cursor: framePending ? 'default' : 'pointer',
              '&:hover': { background: 'var(--frame-bg)' },
            }),
            on('click', async () => {
              if (framePending || topPending) return
              framePending = true
              handle.update()
              let signal = await handle.frame.reload()
              if (signal.aborted) return
              framePending = false
              handle.update()
            }),
          ]}
          style={{
            '--frame-bg': framePending ? undefined : 'rgba(255,255,255,0.10)',
          }}
        >
          {framePending ? 'Reloading frame…' : 'Reload this frame'}
        </button>
        <button
          type="button"
          mix={[
            css({
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: topPending ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
              color: '#e9eefc',
              cursor: topPending ? 'default' : 'pointer',
              '&:hover': { background: 'var(--top-bg)' },
            }),
            on('click', async () => {
              if (topPending || framePending) return
              topPending = true
              handle.update()
              let signal = await handle.frames.top.reload()
              if (signal.aborted) return
              topPending = false
              handle.update()
            }),
          ]}
          style={{
            '--top-bg': topPending ? undefined : 'rgba(255,255,255,0.10)',
          }}
        >
          {topPending ? 'Reloading page…' : 'Reload top frame'}
        </button>
      </div>
    )
  },
)
