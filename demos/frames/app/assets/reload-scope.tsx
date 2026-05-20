import { clientEntry, css, on, type Handle } from 'remix/ui'

export const ReloadScope = clientEntry(
  '/assets/reload-scope.js#ReloadScope',
  function ReloadScope(handle: Handle) {
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
            reloadButtonStyle(framePending),
            on('click', () => {
              void handle.frame.reload()
            }),
          ]}
          style={{
            '--frame-bg': framePending ? undefined : 'rgba(255,255,255,0.10)',
          }}
        >
          {framePending ? 'Reloading frame…' : 'Reload this frame'}
        </button>
      </div>
    )
  },
)

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
          reloadButtonStyle(pending),
          on('click', () => {
            void handle.frames.top.reload()
          }),
        ]}
        style={{
          '--frame-bg': pending ? undefined : 'rgba(255,255,255,0.10)',
        }}
      >
        {pending ? 'Reloading page…' : 'Reload top frame'}
      </button>
    )
  },
)

function reloadButtonStyle(pending: boolean) {
  return css({
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: pending ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
    color: '#e9eefc',
    cursor: 'pointer',
    '&:hover': { background: 'var(--frame-bg)' },
  })
}
