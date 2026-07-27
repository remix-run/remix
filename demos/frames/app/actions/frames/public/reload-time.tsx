import { clientEntry, css, on, type Handle } from 'remix/ui'

export const ReloadTime = clientEntry(import.meta.url, function ReloadTime(handle: Handle) {
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
      data-pending={pending ? '' : undefined}
      mix={[
        refreshButtonStyle,
        on('click', () => {
          void handle.frame.reload()
        }),
      ]}
    >
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
})

const refreshButtonStyle = css({
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e9eefc',
  cursor: 'pointer',
  '&:hover': { background: 'rgba(255,255,255,0.10)' },
  '&[data-pending]': { background: 'rgba(255,255,255,0.04)' },
})
