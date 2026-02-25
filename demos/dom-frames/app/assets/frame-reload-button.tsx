import { clientEntry, css, on, type ComponentHandle } from '@remix-run/dom'

export let FrameReloadButton = clientEntry(
  '/assets/frame-reload-button.js#FrameReloadButton',
  function FrameReloadButton(handle: ComponentHandle) {
    let pending = false
    return () => (
      <button
        type="button"
        mix={[
          css({
            border: '1px solid #2a3c60',
            borderRadius: '10px',
            padding: '8px 12px',
            background: pending ? '#223259' : '#182542',
            color: '#f1f5ff',
            fontSize: '14px',
            cursor: pending ? 'wait' : 'pointer',
          }),
          on('click', async () => {
            pending = true
            handle.update()
            let signal = await handle.frame.reload()
            if (signal.aborted) return
            pending = false
            handle.update()
          }),
        ]}
      >
        {pending ? 'Reloading frame…' : 'Reload frame'}
      </button>
    )
  },
)
