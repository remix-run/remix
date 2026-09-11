import { clientEntry, css, on, type Handle } from 'remix/ui'

type FramePlaygroundProps = {
  initialCount: number
  actionLabel: string
  accent: 'coral' | 'violet' | 'teal'
  servedAt: string
}

export const FramePlayground = clientEntry(
  import.meta.url,
  function FramePlayground(handle: Handle<FramePlaygroundProps>) {
    let count = handle.props.initialCount
    let hydrated = false

    handle.queueTask(() => {
      hydrated = true
      handle.update()
    })

    return () => (
      <div mix={playgroundStyle}>
        <div mix={statusRowStyle}>
          <span
            aria-hidden="true"
            mix={[statusDotStyle, hydrated ? readyDotStyle : pendingDotStyle]}
          />
          {hydrated ? 'Client component ready' : 'Hydrating client component…'}
        </div>

        <p mix={countStyle}>Local count: {count}</p>
        <div mix={buttonRowStyle}>
          <button
            type="button"
            mix={[
              actionButtonStyle,
              accentStyles[handle.props.accent],
              on('click', () => {
                count++
                handle.update()
              }),
            ]}
          >
            {handle.props.actionLabel}
          </button>
          <button
            type="button"
            mix={[
              reloadButtonStyle,
              on('click', async () => {
                await handle.frame.reload()
              }),
            ]}
          >
            Reload Frame
          </button>
        </div>

        <p mix={servedAtStyle}>
          Frame response rendered at <time>{handle.props.servedAt}</time>. Local count is retained
          when the Frame reloads.
        </p>
      </div>
    )
  },
)

const playgroundStyle = css({
  marginTop: '24px',
})

const statusRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 650,
  color: 'var(--interactive-muted)',
})

const statusDotStyle = css({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
})

const pendingDotStyle = css({
  backgroundColor: 'var(--interactive-pending)',
})

const readyDotStyle = css({
  backgroundColor: '#13866f',
  boxShadow: '0 0 0 4px rgba(19, 134, 111, 0.12)',
})

const countStyle = css({
  margin: '14px 0 16px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '18px',
  fontWeight: 700,
  color: 'var(--interactive-text)',
})

const buttonRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
})

const actionButtonStyle = css({
  border: 0,
  borderRadius: '6px',
  padding: '11px 17px',
  font: 'inherit',
  fontSize: '14px',
  fontWeight: 750,
  color: '#ffffff',
  cursor: 'pointer',
  '&:hover': {
    filter: 'brightness(0.92)',
  },
  '&:focus-visible': {
    outline: '3px solid var(--interactive-text)',
    outlineOffset: '3px',
  },
})

const accentStyles = {
  coral: css({ backgroundColor: '#d4543f' }),
  violet: css({ backgroundColor: '#7557c8' }),
  teal: css({ backgroundColor: '#157c70' }),
}

const reloadButtonStyle = css({
  border: '1px solid var(--interactive-button-border)',
  borderRadius: '6px',
  padding: '10px 16px',
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--interactive-button-text)',
  cursor: 'pointer',
  '&:hover': {
    borderColor: 'var(--interactive-accent)',
    backgroundColor: 'var(--interactive-button-hover)',
  },
  '&:focus-visible': {
    outline: '3px solid var(--interactive-accent)',
    outlineOffset: '3px',
  },
})

const servedAtStyle = css({
  margin: '16px 0 0',
  fontSize: '12px',
  lineHeight: 1.6,
  color: 'var(--interactive-subtle)',
})
