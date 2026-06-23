import { clientEntry, css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

type RefreshFrameButtonProps = {
  label: string
}

export const RefreshFrameButton = clientEntry(
  import.meta.url,
  function RefreshFrameButton(handle: Handle<RefreshFrameButtonProps>) {
    return () => (
      <button
        mix={[
          buttonStyles,
          on('click', async () => {
            await handle.frame.reload()
          }),
        ]}
        type="button"
      >
        {handle.props.label}
      </button>
    )
  },
)

const buttonStyles = css({
  appearance: 'none',
  border: '1px solid var(--red-brand)',
  borderRadius: '999px',
  background: 'var(--red-brand)',
  color: 'white',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: '700',
  lineHeight: '1',
  padding: '0.7rem 1rem',
  '&:hover': {
    filter: 'brightness(0.95)',
  },
})
