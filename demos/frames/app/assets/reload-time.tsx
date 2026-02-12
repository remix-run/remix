import { clientEntry, type Handle } from 'remix/component'

export let ReloadTime = clientEntry(
  '/assets/reload-time.js#ReloadTime',
  function ReloadTime(handle: Handle) {
    let pending = false

    return () => (
      <button
        type="button"
        css={{
          padding: '6px 10px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.18)',
          background: pending ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
          color: '#e9eefc',
          cursor: pending ? 'default' : 'pointer',
          '&:hover': { background: 'var(--bg)' },
        }}
        style={{
          '--bg': pending ? undefined : 'rgba(255,255,255,0.1)',
        }}
        on={{
          async click() {
            pending = true
            handle.update()
            let reloadSignal = await handle.frame.reload()
            if (reloadSignal.aborted) return
            pending = false
            handle.update()
          },
        }}
      >
        {pending ? 'Refreshing…' : 'Refresh'}
      </button>
    )
  },
)
