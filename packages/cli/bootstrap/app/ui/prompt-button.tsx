import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

const FADE_MS = 180
const HOLD_MS = 1200

type CopyState = 'idle' | 'copied' | 'failed' | 'resetting'

interface PromptButtonProps extends SerializableProps {
  text: string
}

export const PromptButton = clientEntry(
  '/assets/app/ui/prompt-button.tsx#PromptButton',
  function PromptButton(handle: Handle<PromptButtonProps>) {
    let state: CopyState = 'idle'

    return () => {
      let promptLabel = `\u201C${handle.props.text}\u201D`
      let label =
        state === 'copied' || state === 'resetting'
          ? 'Copied to clipboard'
          : state === 'failed'
            ? 'Copy failed'
            : promptLabel
      let active = state === 'copied' || state === 'failed' || state === 'resetting'

      return (
        <button
          type="button"
          className={state}
          style={{
            background: active ? 'var(--surface-4)' : undefined,
            color: active ? 'var(--brand-blue)' : undefined,
          }}
          mix={[
            buttonStyle,
            on('click', async (_event, signal) => {
              try {
                await navigator.clipboard.writeText(handle.props.text)
                if (signal.aborted) return
              } catch {
                state = 'failed'
                await handle.update()
                await wait(HOLD_MS)
                if (signal.aborted) return
                state = 'resetting'
                await handle.update()
                await wait(FADE_MS)
                if (signal.aborted) return
                state = 'idle'
                handle.update()
                return
              }

              state = 'copied'
              await handle.update()
              await wait(HOLD_MS)
              if (signal.aborted) return

              state = 'resetting'
              await handle.update()
              await wait(FADE_MS)
              if (signal.aborted) return

              state = 'idle'
              await handle.update()
            }),
          ]}
        >
          <span aria-hidden="true" mix={iconSlotStyle}>
            <CopyIcon />
          </span>
          <span
            mix={css({
              alignItems: 'center',
              display: 'flex',
              fontSize: '14px',
              flex: '1 1 0',
              lineHeight: 1.5,
              minWidth: 0,
              position: 'relative',
              transition: 'opacity 180ms ease',
            })}
            style={{ opacity: state === 'resetting' ? 0 : undefined }}
          >
            <span
              aria-hidden={state === 'idle' ? true : undefined}
              style={{
                alignItems: 'center',
                display: 'flex',
                inset: 0,
                position: 'absolute',
                visibility: state === 'idle' ? 'hidden' : 'visible',
              }}
            >
              {label}
            </span>
            <span
              aria-hidden={state === 'idle' ? undefined : true}
              style={{ visibility: state === 'idle' ? 'visible' : 'hidden' }}
            >
              {promptLabel}
            </span>
          </span>
        </button>
      )
    }
  },
)

export function CopyIcon() {
  return () => (
    <svg viewBox="0 0 14 16.5" fill="none">
      <path
        d="M0.75 9.188L0.75 4.083C0.75 2.242 2.242 0.75 4.083 0.75L9.188 0.75M5.75 15.75L11.375 15.75C12.41 15.75 13.25 14.91 13.25 13.875L13.25 5.75C13.25 4.714 12.41 3.875 11.375 3.875L5.75 3.875C4.714 3.875 3.875 4.714 3.875 5.75L3.875 13.875C3.875 14.91 4.714 15.75 5.75 15.75Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  )
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

const buttonStyle = css({
  appearance: 'none',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  padding: '16px',
  border: 0,
  borderRadius: '12px',
  color: 'var(--text-primary)',
  background: 'transparent',
  transition: 'background-color 150ms ease, color 150ms ease',
  '&:hover, &:focus-visible': {
    background: 'var(--surface-4)',
    color: 'var(--brand-blue)',
    outline: 'none',
  },
})

const iconSlotStyle = css({
  flex: '0 0 24px',
  width: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': {
    width: '20px',
    height: '20px',
    display: 'block',
    transform: 'rotate(180deg)',
  },
})
