import type { Handle } from 'remix/component'
import { animateEntrance, animateExit, css, on } from 'remix/component'

let nextId = 1
function createItem() {
  return { id: nextId++, label: `Row ${nextId - 1}` }
}

export function MixinPresenceList(handle: Handle) {
  let items = [createItem(), createItem(), createItem()]

  return () => (
    <div
      mix={[
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: 220,
        }),
      ]}
    >
      <div mix={[css({ display: 'flex', gap: 8 })]}>
        <button
          mix={[
            css({
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: 6,
              backgroundColor: '#0ea5e9',
              color: 'white',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#0284c7' },
            }),
            on('click', () => {
              items.unshift(createItem())
              handle.update()
            }),
          ]}
        >
          Add
        </button>
        <button
          mix={[
            css({
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: 6,
              backgroundColor: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#dc2626' },
            }),
            on('click', () => {
              items = items.slice(0, Math.max(0, items.length - 1))
              handle.update()
            }),
          ]}
        >
          Remove
        </button>
      </div>
      {items.map((item) => (
        <div
          key={String(item.id)}
          mix={[
            animateEntrance({
              opacity: 0,
              transform: 'translateY(-10px) scale(0.98)',
              duration: 220,
              easing: 'ease-out',
            }),
            animateExit({
              opacity: 0,
              transform: 'translateY(10px) scale(0.98)',
              duration: 180,
              easing: 'ease-in',
            }),
            css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #e2e8f0',
            }),
          ]}
        >
          <span>{item.label}</span>
          <button
            mix={[
              css({
                width: 24,
                height: 24,
                padding: 0,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'transparent',
                color: '#64748b',
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#e2e8f0' },
              }),
              on('click', () => {
                items = items.filter((entry) => entry.id !== item.id)
                handle.update()
              }),
            ]}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
