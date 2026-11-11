import { createRoot, on } from '@remix-run/component'
import { press } from '../press.ts'

declare global {
  interface Window {
    log: string[]
  }
}

window.log = []
window.addEventListener('hashchange', record('hash'))

function record(name: string) {
  return () => {
    window.log.push(name)
  }
}

function PressLifecycleFixture() {
  return () => (
    <div>
      <button
        id="plain"
        mix={[
          press({
            onPressStart: record('start'),
            onPressEnd: (end) => record(end.cancelled ? 'cancel' : 'end')(),
          }),
          on('click', record('click')),
        ]}
      >
        Plain
      </button>
      <button
        id="long"
        mix={[
          press({
            longPressDuration: 300,
            onPressStart: record('start'),
            onPressEnd: (end) => record(end.cancelled ? 'cancel' : 'end')(),
            onLongPress: record('long'),
          }),
          on('click', record('click')),
        ]}
      >
        Long
      </button>
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          let { submitter } = event as SubmitEvent
          window.log.push(`submit:${(submitter as HTMLButtonElement).value}`)
        })}
      >
        <button
          id="submit"
          type="submit"
          value="save"
          mix={press({ longPressDuration: 300, onLongPress: record('long') })}
        >
          Save
        </button>
        <button id="native-submit" type="submit" value="native">
          Native
        </button>
      </form>
      <a
        id="link"
        href="#linked"
        mix={[
          press({
            longPressDuration: 300,
            onPressStart: record('start'),
            onPressEnd: (end) => record(end.cancelled ? 'cancel' : 'end')(),
            onLongPress: record('long'),
          }),
          on('click', record('click')),
        ]}
      >
        Link
      </a>
      <button
        id="gated"
        mix={[
          press({
            longPressDuration: 2000,
            onPressStart: record('start'),
            onPressEnd: (end) => record(end.cancelled ? 'cancel' : 'end')(),
            onLongPress: record('long'),
          }),
          on('click', () => {
            window.log.push(`active:${navigator.userActivation.isActive}`)
          }),
        ]}
      >
        Gated
      </button>
    </div>
  )
}

const container = document.createElement('div')
document.body.append(container)
createRoot(container).render(<PressLifecycleFixture />)
