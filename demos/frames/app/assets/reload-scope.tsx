import { clientEntry, css, on, type Handle } from 'remix/ui'

import { reloadButtonStyle } from './reload-button-style.ts'

export const ReloadScope = clientEntry(import.meta.url, function ReloadScope(handle: Handle) {
  let framePending = false

  handle.frame.addEventListener(
    'reloadStart',
    () => {
      framePending = true
      handle.update()
    },
    { signal: handle.signal },
  )

  handle.frame.addEventListener(
    'reloadComplete',
    () => {
      framePending = false
      handle.update()
    },
    { signal: handle.signal },
  )

  return () => (
    <div mix={css({ display: 'flex', gap: 8, flexWrap: 'wrap' })}>
      <button
        type="button"
        mix={[
          reloadButtonStyle,
          on('click', () => {
            void handle.frame.reload()
          }),
        ]}
        style={framePending ? { background: 'rgba(255,255,255,0.04)' } : undefined}
      >
        {framePending ? 'Reloading frame…' : 'Reload this frame'}
      </button>
    </div>
  )
})

export const ReloadTopFrame = clientEntry(
  '/assets/reload-scope.js#ReloadTopFrame',
  function ReloadTopFrame(handle: Handle) {
    let pending = false

    handle.frames.top.addEventListener(
      'reloadStart',
      () => {
        pending = true
        handle.update()
      },
      { signal: handle.signal },
    )

    handle.frames.top.addEventListener(
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
            void handle.frames.top.reload()
          }),
        ]}
        style={pending ? { background: 'rgba(255,255,255,0.04)' } : undefined}
      >
        {pending ? 'Reloading page…' : 'Reload top frame'}
      </button>
    )
  },
)
