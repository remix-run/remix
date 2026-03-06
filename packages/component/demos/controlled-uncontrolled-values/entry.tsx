import { createRoot, on, type Handle } from 'remix/component'

function App(handle: Handle) {
  let controlledText = 'hello'
  let controlledChecked = true
  let uncontrolledTextSnapshot = 'type to update this'
  let uncontrolledCheckedSnapshot = true
  let renderCount = 0
  let uncontrolledVersion = 0

  let rerender = () => {
    renderCount++
    handle.update()
  }

  let resetControlled = () => {
    controlledText = 'hello'
    controlledChecked = true
    rerender()
  }

  let remountUncontrolled = () => {
    uncontrolledVersion++
    uncontrolledTextSnapshot = 'type to update this'
    uncontrolledCheckedSnapshot = true
    rerender()
  }

  return () => (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '860px',
        margin: '24px auto',
        padding: '0 16px',
        lineHeight: 1.45,
      }}
    >
      <h1>Controlled vs Uncontrolled Values</h1>

      <p>
        Render count: <strong>{renderCount}</strong>
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button mix={[on('click', rerender)]}>Force Re-render</button>
        <button mix={[on('click', resetControlled)]}>Reset Controlled</button>
        <button mix={[on('click', remountUncontrolled)]}>Remount Uncontrolled</button>
      </div>

      <section
        style={{
          border: '1px solid #d0d7de',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
        }}
      >
        <h2>Controlled</h2>
        <p>
          These values come from component state. The text input allows everything except digits,
          and invalid input does not call update.
        </p>

        <label style={{ display: 'block', marginBottom: '8px' }}>
          Text:
          <input
            style={{ marginLeft: '8px' }}
            value={controlledText}
            mix={[
              on('input', (event) => {
                let nextValue = event.currentTarget.value
                if (/\d/.test(nextValue)) {
                  return
                }
                controlledText = nextValue
                rerender()
              }),
            ]}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={controlledChecked}
            mix={[
              on('change', (event) => {
                controlledChecked = event.currentTarget.checked
                rerender()
              }),
            ]}
          />{' '}
          Checked
        </label>

        <div>
          State snapshot: text=<code>{JSON.stringify(controlledText)}</code>, checked=
          <code>{String(controlledChecked)}</code>
        </div>
      </section>

      <section
        key={`uncontrolled-${uncontrolledVersion}`}
        style={{
          border: '1px solid #d0d7de',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <h2>Uncontrolled</h2>
        <p>
          These initialize from <code>defaultValue/defaultChecked</code> once and then keep their
          own DOM state.
        </p>

        <label style={{ display: 'block', marginBottom: '8px' }}>
          Text:
          <input
            style={{ marginLeft: '8px' }}
            defaultValue="type to update this"
            mix={[
              on('input', (event) => {
                uncontrolledTextSnapshot = event.currentTarget.value
                rerender()
              }),
            ]}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '8px' }}>
          <input
            type="checkbox"
            defaultChecked={true}
            mix={[
              on('change', (event) => {
                uncontrolledCheckedSnapshot = event.currentTarget.checked
                rerender()
              }),
            ]}
          />{' '}
          Checked
        </label>

        <div>
          Last DOM snapshot: text=<code>{JSON.stringify(uncontrolledTextSnapshot)}</code>, checked=
          <code>{String(uncontrolledCheckedSnapshot)}</code>
        </div>
      </section>
    </main>
  )
}

let root = createRoot(document.body)
root.render(<App />)
