import { clientEntry, on, type ComponentHandle } from '@remix-run/dom'

type CounterProps = {
  label: string
  serverTime?: string
}

export let SimpleCounter = clientEntry(
  '/assets/simple-counter.js#SimpleCounter',
  function SimpleCounter(handle: ComponentHandle, initial: number) {
    let count = initial
    return (props: CounterProps) => (
      <button
        type="button"
        style={{
          border: '1px solid #2a3c60',
          borderRadius: '10px',
          padding: '8px 12px',
          background: '#182542',
          color: '#f1f5ff',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'grid',
          textAlign: 'left',
          gap: '4px',
        }}
        mix={[
          on('click', () => {
            count++
            void handle.update()
          }),
        ]}
      >
        <span>
          {props.label}: {count}
        </span>
        {props.serverTime ? (
          <span style={{ fontSize: '12px', color: '#b5c5f9' }}>Server: {props.serverTime}</span>
        ) : null}
      </button>
    )
  },
)
