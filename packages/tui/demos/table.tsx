import { createOpenTuiRoot } from '@remix-run/tui'

let rerender = () => {}

function TableDemo(handle: { update(): Promise<AbortSignal> }, _setup: unknown) {
  let rows = [
    { id: 1, label: 'alpha' },
    { id: 2, label: 'bravo' },
    { id: 3, label: 'charlie' },
    { id: 4, label: 'delta' },
  ]
  let ascending = true

  rerender = () => {
    rows = rows
      .slice()
      .sort((a, b) => (ascending ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)))
    ascending = !ascending
    void handle.update()
  }

  return () => (
    <box layout={{ direction: 'column' }}>
      <text style={{ bold: true }}>table demo (sorting every 1500ms)</text>
      {rows.map((row) => (
        <row key={row.id} style={{ color: 'cyan' }}>
          {`${row.id}: ${row.label}`}
        </row>
      ))}
    </box>
  )
}

let runtime = await createOpenTuiRoot()
runtime.root.render(<TableDemo />)
runtime.root.flush()

let timer = setInterval(() => {
  rerender()
}, 1500)

let shutdown = () => {
  clearInterval(timer)
  runtime.dispose()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
