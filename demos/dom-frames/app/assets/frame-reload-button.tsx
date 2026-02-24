import { clientEntry, on, type ComponentHandle } from '@remix-run/dom'

export let FrameReloadButton = clientEntry(
  '/assets/frame-reload-button.js#FrameReloadButton',
  function FrameReloadButton(handle: ComponentHandle) {
    let pending = false
    return () => (
      <button
        type="button"
        style={{
          border: '1px solid #2a3c60',
          borderRadius: '10px',
          padding: '8px 12px',
          background: pending ? '#223259' : '#182542',
          color: '#f1f5ff',
          fontSize: '14px',
          cursor: pending ? 'wait' : 'pointer',
        }}
        mix={[
          on('click', async () => {
            if (pending) return
            if (!handle.frame) return
            pending = true
            void handle.update()
            try {
              await handle.frame.reload()
            } finally {
              pending = false
              void handle.update()
            }
          }),
        ]}
      >
        {pending ? 'Reloading frame…' : 'Reload frame'}
      </button>
    )
  },
)
