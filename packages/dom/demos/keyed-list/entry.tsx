import { on, render } from '@remix-run/dom/spa'

type ListItem = {
  id: string
  label: string
}

function App(handle: { update(): Promise<AbortSignal> }, _setup: unknown) {
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
    void handle.update()
  }

  let moveDown = (index: number) => {
    if (index === items.length - 1) return
    let newItems = [...items]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    items = newItems
    void handle.update()
  }

  let reverse = () => {
    items = [...items].reverse()
    void handle.update()
  }

  let shuffle = () => {
    let newItems = [...items]
    for (let index = newItems.length - 1; index > 0; index--) {
      let nextIndex = Math.floor(Math.random() * (index + 1))
      ;[newItems[index], newItems[nextIndex]] = [newItems[nextIndex], newItems[index]]
    }
    items = newItems
    void handle.update()
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
    void handle.update()
  }

  return () => (
    <div>
      <div className="controls">
        <button mix={[on('click', reverse)]}>Reverse List</button>
        <button mix={[on('click', shuffle)]}>Shuffle List</button>
        <button mix={[on('click', toggleAutoShuffle)]}>
          {shuffleInterval !== null ? 'Stop Auto-Shuffle' : 'Start Auto-Shuffle'}
        </button>
      </div>

      {items.map((item, index) => (
        <div key={item.id} className="list-item">
          <input type="text" placeholder={item.label} defaultValue={item.label} />
          <button mix={[on('click', () => moveUp(index))]}>↑</button>
          <button mix={[on('click', () => moveDown(index))]}>↓</button>
        </div>
      ))}
    </div>
  )
}

let container = document.getElementById('app')
if (!container) {
  throw new Error('expected #app container')
}
let root = render(<App />, container)
