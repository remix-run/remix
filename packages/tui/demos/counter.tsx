import { createOpenTuiRoot } from '@remix-run/tui'

let triggerUpdate = () => {}

function Counter(handle: { update(): Promise<AbortSignal> }, _setup: unknown) {
  let count = 0
  triggerUpdate = () => {
    count++
    void handle.update()
  }
  return () => (
    <box layout={{ direction: 'column' }} style={{ color: 'green', bold: true }}>
      <text>{`count: ${count}`}</text>
      <text>updates are driven via captured handle.update()</text>
    </box>
  )
}

let runtime = await createOpenTuiRoot()
runtime.root.render(<Counter />)
runtime.root.flush()

let timer = setInterval(() => {
  triggerUpdate()
}, 1000)

let shutdown = () => {
  clearInterval(timer)
  runtime.dispose()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
