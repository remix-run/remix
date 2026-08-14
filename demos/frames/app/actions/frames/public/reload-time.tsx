import { clientEntry, on, type Handle } from 'remix/ui'

import { reloadButtonStyle } from '../../../ui/public/styles.ts'

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
      mix={[
        reloadButtonStyle,
        on('click', () => {
          void handle.frame.reload()
        }),
      ]}
      style={pending ? { background: 'rgba(255,255,255,0.04)' } : undefined}
    >
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
})
