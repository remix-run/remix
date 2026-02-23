import { animateLayout, on, spring } from '@remix-run/dom'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

let nextId = 1
function createItem() {
  return { id: nextId++, label: `Item ${nextId - 1}` }
}

export function AnimateLayout(handle: DemoHandle, _setup: unknown) {
  let items = [createItem(), createItem()]
  let layoutSpring = spring('snappy')
  let rerender = () => {
    void handle.update()
  }

  return () => (
    <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          mix={[
            on('click', () => {
              items.unshift(createItem())
              rerender()
            }),
          ]}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            backgroundColor: '#10b981',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Add
        </button>
        <button
          mix={[
            on('click', () => {
              for (let index = items.length - 1; index > 0; index--) {
                let nextIndex = Math.floor(Math.random() * (index + 1))
                ;[items[index], items[nextIndex]] = [items[nextIndex], items[index]]
              }
              rerender()
            }),
          ]}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            backgroundColor: '#6366f1',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Shuffle
        </button>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          mix={[animateLayout({ duration: layoutSpring.duration, easing: layoutSpring.easing })]}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 14,
            fontWeight: 500,
            color: '#334155',
          }}
        >
          <span>{item.label}</span>
          <button
            mix={[
              on('click', () => {
                items = items.filter((entry) => entry.id !== item.id)
                rerender()
              }),
            ]}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              width: 20,
              height: 20,
              color: '#94a3b8',
            }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  )
}
