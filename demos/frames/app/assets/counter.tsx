import { clientEntry, type Handle } from 'remix/component'

export let Counter = clientEntry(
  '/assets/counter.js#Counter',
  function Counter(handle: Handle, setup: number) {
    let count = setup

    return (props: { label: string }) => (
      <div css={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong css={{ width: 72 }}>{props.label}</strong>
        <button
          type="button"
          css={{
            padding: '6px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e9eefc',
            cursor: 'pointer',
            '&:hover': { background: 'rgba(255,255,255,0.10)' },
          }}
          on={{
            click() {
              count--
              handle.update()
            },
          }}
        >
          −
        </button>
        <span css={{ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
        <button
          type="button"
          css={{
            padding: '6px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e9eefc',
            cursor: 'pointer',
            '&:hover': { background: 'rgba(255,255,255,0.10)' },
          }}
          on={{
            click() {
              count++
              handle.update()
            },
          }}
        >
          +
        </button>
      </div>
    )
  },
)
