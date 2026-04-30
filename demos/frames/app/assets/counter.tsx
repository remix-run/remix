import { clientEntry, css, on, type Handle } from 'remix/ui'

export const Counter = clientEntry(
  '/assets/counter.js#Counter',
  function Counter(handle: Handle<{ initialCount: number; label: string }>) {
    let count = handle.props.initialCount

    return () => (
      <div mix={css({ display: 'flex', gap: 12, alignItems: 'center' })}>
        <strong mix={css({ width: 72 })}>{handle.props.label}</strong>
        <button
          type="button"
          mix={[
            css({
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e9eefc',
              cursor: 'pointer',
              '&:hover': { background: 'rgba(255,255,255,0.10)' },
            }),
            on('click', () => {
              count--
              handle.update()
            }),
          ]}
        >
          −
        </button>
        <span mix={css({ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' })}>
          {count}
        </span>
        <button
          type="button"
          mix={[
            css({
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e9eefc',
              cursor: 'pointer',
              '&:hover': { background: 'rgba(255,255,255,0.10)' },
            }),
            on('click', () => {
              count++
              handle.update()
            }),
          ]}
        >
          +
        </button>
      </div>
    )
  },
)
