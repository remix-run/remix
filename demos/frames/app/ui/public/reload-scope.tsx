import { clientEntry, css, on, type Handle } from 'remix/ui'

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
        data-pending={framePending ? '' : undefined}
        mix={[
          reloadButtonStyle,
          on('click', () => {
            void handle.frame.reload()
          }),
        ]}
      >
        {framePending ? 'Reloading frame…' : 'Reload this frame'}
      </button>
    </div>
  )
})

export const ReloadTopFrame = clientEntry(import.meta.url, function ReloadTopFrame(handle: Handle) {
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
      data-pending={pending ? '' : undefined}
      mix={[
        reloadButtonStyle,
        on('click', () => {
          void handle.frames.top.reload()
        }),
      ]}
    >
      {pending ? 'Reloading page…' : 'Reload top frame'}
    </button>
  )
})

const reloadButtonStyle = css({
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e9eefc',
  cursor: 'pointer',
  '&:hover': { background: 'rgba(255,255,255,0.10)' },
  '&[data-pending]': { background: 'rgba(255,255,255,0.04)' },
})
