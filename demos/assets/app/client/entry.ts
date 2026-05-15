// Deliberately extensionless so the demo can show resolution winner changes in watch mode.
// oxlint-disable-next-line import/extensions
import { getContent } from './content'

const root = document.getElementById('app-root')

if (!(root instanceof HTMLElement)) {
  throw new Error('Expected #app-root to exist')
}

root.innerHTML = `
  <section class="client-card">
    <h2>Client code is live</h2>
    <p>
      This UI comes from browser-only modules served by <code>remix/assets</code>.
    </p>
    <p>${getContent()}</p>
    <p class="client-note">
      Refresh after editing this file to confirm the server keeps running.
    </p>
  </section>
`
