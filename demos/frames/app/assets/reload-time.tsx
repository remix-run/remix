import { clientEntry, css, on, type Handle } from 'remix/ui'

export const ReloadTime = clientEntry(
  '/assets/reload-time.js#ReloadTime',
  function ReloadTime(handle: Handle) {
    let pending = false

    handle.frame.addEventListener(
      'reloadStart',
      () => {
        pending = true
        handle.update()
      },
      { signal: handle.signal },
    )

    handle.frame.addEventListener(
      'reloadComplete',
      () => {
        pending = false
        handle.update()
      },
      { signal: handle.signal },
    )

    return () => (
      <button
        type="button"
        mix={[
          css({
            padding: '6px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: pending ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
            color: '#e9eefc',
            cursor: 'pointer',
            '&:hover': { background: 'var(--bg)' },
          }),
          on('click', () => {
            void handle.frame.reload()
          }),
        ]}
        style={{
          '--bg': pending ? undefined : 'rgba(255,255,255,0.1)',
        }}
      >
        {pending ? 'Refreshing…' : 'Refresh'}
      </button>
    )
  },
)
