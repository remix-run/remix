import { clientEntry, css, on, type Handle } from 'remix/component'

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
      <div
        mix={css({
          marginTop: '24px',
        })}
      >
        <div
          mix={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 650,
            color: 'var(--interactive-muted)',
          })}
        >
          <span
            aria-hidden="true"
            mix={[
              css({
                width: '8px',
                height: '8px',
                borderRadius: '50%',
              }),
              hydrated
                ? css({
                    backgroundColor: '#13866f',
                    boxShadow: '0 0 0 4px rgba(19, 134, 111, 0.12)',
                  })
                : css({
                    backgroundColor: 'var(--interactive-pending)',
                  }),
            ]}
          />
          {hydrated ? 'Client component ready' : 'Hydrating client component…'}
        </div>

        <p
          mix={css({
            margin: '14px 0 16px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--interactive-text)',
          })}
        >
          Local count: {count}
        </p>
        <div
          mix={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
          })}
        >
          <button
            type="button"
            mix={[
              on('click', () => {
                count++
                handle.update()
              }),
              css({
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
              }),
              accentStyles[handle.props.accent],
            ]}
          >
            {handle.props.actionLabel}
          </button>
          <button
            type="button"
            mix={[
              on('click', async () => {
                await handle.frame.reload()
              }),
              css({
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
              }),
            ]}
          >
            Reload Frame
          </button>
        </div>

        <p
          mix={css({
            margin: '16px 0 0',
            fontSize: '12px',
            lineHeight: 1.6,
            color: 'var(--interactive-subtle)',
          })}
        >
          Frame response rendered at <time>{handle.props.servedAt}</time>. Local count is retained
          when the Frame reloads.
        </p>
      </div>
    )
  },
)

const accentStyles = {
  coral: css({ backgroundColor: '#d4543f' }),
  violet: css({ backgroundColor: '#7557c8' }),
  teal: css({ backgroundColor: '#157c70' }),
}
