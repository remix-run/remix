import { css, on, type Handle } from '@remix-run/ui'

/**
 * @name Controlled and Uncontrolled Values
 * @description Compares controlled props with uncontrolled DOM values across rerenders and remounts.
 */
export default function App(handle: Handle) {
  let controlledText = 'hello'
  let controlledChecked = true
  let controlledChoice = 'alpha'
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
    controlledChoice = 'alpha'
    rerender()
  }

  let remountUncontrolled = () => {
    uncontrolledVersion++
    uncontrolledTextSnapshot = 'type to update this'
    uncontrolledCheckedSnapshot = true
    rerender()
  }

  return () => (
    <main mix={pageStyle}>
      <h1>Controlled vs Uncontrolled Values</h1>

      <p>
        Render count: <strong>{renderCount}</strong>
      </p>

      <div mix={toolbarStyle}>
        <button mix={[on('click', rerender)]}>Force Re-render</button>
        <button mix={[on('click', resetControlled)]}>Reset Controlled</button>
        <button mix={[on('click', remountUncontrolled)]}>Remount Uncontrolled</button>
      </div>

      <section mix={[sectionStyle, css({ marginBottom: '12px' })]}>
        <h2>Controlled</h2>
        <p>
          These values come from component state. The text input allows everything except digits,
          and invalid input does not call update.
        </p>

        <label mix={fieldStyle}>
          Text:
          <input
            value={controlledText}
            mix={[
              inlineControlStyle,
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

        <label mix={fieldStyle}>
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

        <label mix={fieldStyle}>
          Choice:
          <select
            value={controlledChoice}
            mix={[
              inlineControlStyle,
              on('change', (event) => {
                controlledChoice = event.currentTarget.value
                rerender()
              }),
            ]}
          >
            <option value="alpha">Alpha</option>
            <option value="beta">Beta</option>
            <option value="gamma">Gamma</option>
          </select>
        </label>

        <div>
          State snapshot: text=<code>{JSON.stringify(controlledText)}</code>, checked=
          <code>{String(controlledChecked)}</code>, choice=
          <code>{JSON.stringify(controlledChoice)}</code>
        </div>
      </section>

      <section key={`uncontrolled-${uncontrolledVersion}`} mix={sectionStyle}>
        <h2>Uncontrolled</h2>
        <p>
          These initialize from <code>defaultValue/defaultChecked</code> once and then keep their
          own DOM state.
        </p>

        <label mix={fieldStyle}>
          Text:
          <input
            defaultValue="type to update this"
            mix={[
              inlineControlStyle,
              on('input', (event) => {
                uncontrolledTextSnapshot = event.currentTarget.value
                rerender()
              }),
            ]}
          />
        </label>

        <label mix={fieldStyle}>
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

const pageStyle = css({
  fontFamily: 'system-ui, sans-serif',
  maxWidth: '860px',
  margin: '24px auto',
  padding: '0 16px',
  lineHeight: 1.45,
})

const toolbarStyle = css({ display: 'flex', gap: '10px', marginBottom: '18px' })

const sectionStyle = css({
  border: '1px solid #d0d7de',
  borderRadius: '8px',
  padding: '12px',
})

const fieldStyle = css({ display: 'block', marginBottom: '8px' })

const inlineControlStyle = css({ marginLeft: '8px' })
