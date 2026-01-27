import type { Handle } from 'remix/component'

let nextId = 1
function createItem() {
  return { id: nextId++, label: `Item ${nextId - 1}` }
}

export function DefaultAnimate(handle: Handle) {
  let items = [createItem(), createItem()]

  return () => (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 200,
        alignSelf: 'flex-start',
      }}
    >
      <div css={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          css={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            backgroundColor: '#10b981',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            '&:hover': { backgroundColor: '#059669' },
          }}
          on={{
            click() {
              items.unshift(createItem())
              handle.update()
            },
          }}
        >
          Add
        </button>
        <button
          css={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            backgroundColor: '#6366f1',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            '&:hover': { backgroundColor: '#4f46e5' },
          }}
          on={{
            click() {
              // Shuffle the array
              for (let i = items.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * (i + 1))
                ;[items[i], items[j]] = [items[j], items[i]]
              }
              handle.update()
            },
          }}
        >
          Shuffle
        </button>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          animate={{ enter: true, exit: false, layout: true }}
          css={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#f1f5f9',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            color: '#334155',
          }}
        >
          <span>{item.label}</span>
          <button
            css={{
              width: 20,
              height: 20,
              padding: 0,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': { backgroundColor: '#e2e8f0', color: '#64748b' },
            }}
            on={{
              click() {
                items = items.filter((i) => i.id !== item.id)
                handle.update()
              },
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
