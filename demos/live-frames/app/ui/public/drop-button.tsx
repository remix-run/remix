import { clientEntry, css, on, type Handle } from 'remix/component'

/**
 * Asks the server to hang up on every open stream, so the frames reconnect on their own.
 */
export const DropButton = clientEntry(
  import.meta.url,
  function DropButton(handle: Handle<{ src: string }>) {
    let dropping = false

    async function drop() {
      dropping = true
      handle.update()
      try {
        await fetch(handle.props.src, { method: 'POST' })
      } finally {
        dropping = false
        handle.update()
      }
    }

    return () => (
      <button
        type="button"
        disabled={dropping}
        mix={[
          on('click', () => void drop()),
          css({
            padding: '0.5rem 0.9rem',
            border: '1px solid #0f172a',
            borderRadius: '8px',
            background: dropping ? '#e2e8f0' : '#0f172a',
            color: dropping ? '#0f172a' : 'white',
            font: 'inherit',
            cursor: 'pointer',
          }),
        ]}
      >
        {dropping ? 'Dropping…' : 'Drop the connection'}
      </button>
    )
  },
)
