import { createRoot, type Handle } from 'remix/component'

type ListItem = {
  id: string
  label: string
}

function App(handle: Handle) {
  let items: ListItem[] = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
    { id: 'c', label: 'Item C' },
    { id: 'd', label: 'Item D' },
  ]

  let shuffleInterval: ReturnType<typeof setInterval> | null = null

  let moveUp = (index: number) => {
    if (index === 0) return
    let newItems = [...items]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    items = newItems
    handle.update()
  }

  let moveDown = (index: number) => {
    if (index === items.length - 1) return
    let newItems = [...items]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    items = newItems
    handle.update()
  }

  let reverse = () => {
    items = [...items].reverse()
    handle.update()
  }

  let shuffle = () => {
    let newItems = [...items]
    for (let i = newItems.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1))
      ;[newItems[i], newItems[j]] = [newItems[j], newItems[i]]
    }
    items = newItems
    handle.update()
  }

  let toggleAutoShuffle = () => {
    if (shuffleInterval !== null) {
      clearInterval(shuffleInterval)
      shuffleInterval = null
    } else {
      shuffleInterval = setInterval(() => {
        shuffle()
      }, 1000)
    }
    handle.update()
  }

  return () => (
    <div>
      <div className="controls">
        <button
          on={{
            click: reverse,
          }}
        >
          Reverse List
        </button>
        <button
          on={{
            click: shuffle,
          }}
        >
          Shuffle List
        </button>
        <button
          on={{
            click: toggleAutoShuffle,
          }}
        >
          {shuffleInterval !== null ? 'Stop Auto-Shuffle' : 'Start Auto-Shuffle'}
        </button>
      </div>

      {items.map((item, index) => (
        <div key={item.id} className="list-item">
          <input type="text" placeholder={item.label} defaultValue={item.label} />
          <button
            // disabled={index === 0}
            on={{
              click: () => moveUp(index),
            }}
          >
            ↑
          </button>
          <button
            // disabled={index === items.length - 1}
            on={{
              click: () => moveDown(index),
            }}
          >
            ↓
          </button>
        </div>
      ))}
    </div>
  )
}

let container = document.getElementById('app')
if (container) {
  createRoot(container).render(<App />)
}
