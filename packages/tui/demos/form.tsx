import { createOpenTuiRoot } from '@remix-run/tui'

let rotateFocus = () => {}

function FormDemo(handle: { update(): Promise<AbortSignal> }, _setup: unknown) {
  let fields = ['name', 'email', 'role']
  let activeIndex = 0
  let values: Record<string, string> = {
    name: 'Ada',
    email: 'ada@example.com',
    role: 'admin',
  }

  rotateFocus = () => {
    activeIndex = (activeIndex + 1) % fields.length
    void handle.update()
  }

  return () => (
    <box layout={{ direction: 'column', gap: 1 }}>
      <text style={{ bold: true }}>form demo (focus rotates every 1200ms)</text>
      {fields.map((field, index) => (
        <row
          key={field}
          style={{
            color: index === activeIndex ? 'yellow' : 'white',
            underline: index === activeIndex,
          }}
          on={{
            focus: () => {},
          }}
        >
          {`${field}: ${values[field]}`}
        </row>
      ))}
    </box>
  )
}

let runtime = await createOpenTuiRoot()
runtime.root.render(<FormDemo />)
runtime.root.flush()

let timer = setInterval(() => {
  rotateFocus()
}, 1200)

let shutdown = () => {
  clearInterval(timer)
  runtime.dispose()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
