// Deliberately extensionless so the demo can show resolution winner changes in watch mode.
// eslint-disable-next-line import/extensions
import { getContent } from './content'

const root = document.getElementById('app-root')

if (!(root instanceof HTMLElement)) {
  throw new Error('Expected #app-root to exist')
}

root.innerHTML = `
  <h2 style="margin-top: 0">Client code is live</h2>
  <p>
    This UI comes from browser-only modules served by <code>script-server</code>.
  </p>
  <p>${getContent()}</p>
  <p style="color: #475569; font-size: 0.95rem; margin-bottom: 0;">
    Refresh after editing this file to confirm the server keeps running.
  </p>
`
