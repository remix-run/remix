import { describePackageSource } from 'demo-copy'

// Deliberately extensionless so the demo can show resolution winner changes in watch mode.
// eslint-disable-next-line import/extensions
import { describeLiveCopy } from './live-copy'

let root = document.getElementById('app-root')

if (!(root instanceof HTMLElement)) {
  throw new Error('Expected #app-root to exist')
}

let rootElement = root

let count = 0
let lazyPanelLoaded = false

render()

function render() {
  rootElement.innerHTML = `
    <h2 style="margin-top: 0">Client app is live</h2>
    <p>
      This UI is browser-only code served by <code>script-server</code>. Refresh after editing a
      client module to verify that the server process stays up while the cache invalidates
    </p>
    <div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
      <section style="background: #0f172a; border-radius: 0.9rem; padding: 1rem;">
        <h3 style="margin-top: 0">Counter</h3>
        <p id="count-output">Count: ${count}</p>
        <button id="count-button" type="button">Increment</button>
      </section>

      <section style="background: #0f172a; border-radius: 0.9rem; padding: 1rem;">
        <h3 style="margin-top: 0">Extensionless import</h3>
        <p>${describeLiveCopy()}</p>
        <p style="font-size: 0.9rem; color: #cbd5e1;">
          Imported from <code>./live-copy</code> with no file extension.
        </p>
      </section>

      <section style="background: #0f172a; border-radius: 0.9rem; padding: 1rem;">
        <h3 style="margin-top: 0">Package export</h3>
        <p>${describePackageSource()}</p>
        <p style="font-size: 0.9rem; color: #cbd5e1;">
          Imported from the local <code>demo-copy</code> package.
        </p>
      </section>
    </div>

    <section style="margin-top: 1rem; background: #0f172a; border-radius: 0.9rem; padding: 1rem;">
      <h3 style="margin-top: 0">Dynamic import</h3>
      <p>
        Click to load a lazily imported panel from <code>./lazy-panel.ts</code>.
      </p>
      <button id="lazy-button" type="button">Load lazy panel</button>
      <div id="lazy-panel" style="margin-top: 1rem;"></div>
    </section>
  `

  let countButton = rootElement.querySelector<HTMLButtonElement>('#count-button')
  let lazyButton = rootElement.querySelector<HTMLButtonElement>('#lazy-button')

  countButton?.addEventListener('click', handleIncrement)
  lazyButton?.addEventListener('click', handleLoadLazyPanel)
}

function handleIncrement() {
  count += 1
  render()
}

async function handleLoadLazyPanel() {
  if (lazyPanelLoaded) return

  lazyPanelLoaded = true
  let panel = rootElement.querySelector<HTMLElement>('#lazy-panel')
  if (!panel) return

  let { renderLazyPanel } = await import('./lazy-panel.ts')
  panel.replaceChildren(renderLazyPanel())
}
