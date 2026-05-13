import * as path from 'node:path'
import { createController } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { assetServer } from '../utils/assets.ts'

const entryFilePath = path.resolve(import.meta.dirname, '../client/entry.ts')

export default createController(routes, {
  actions: {
    async home() {
      let entryUrl = await assetServer.getHref(entryFilePath)

      let html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>remix/assets demo</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }

      body {
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
      }

      main {
        max-width: 42rem;
        margin: 0 auto;
        padding: 3rem 1.5rem;
      }

      h1 {
        margin: 0 0 1rem;
      }

      p {
        line-height: 1.6;
      }

      .app {
        border: 1px solid #cbd5e1;
        border-radius: 0.75rem;
        padding: 1rem;
        margin-top: 1rem;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.95em;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>remix/assets watch mode</h1>
      <p>
        This server stays running while <code>remix/assets</code> watches client files.
        Edit a client module, refresh the page, and the updated code is served without
        restarting the server.
      </p>
      <p>
        Try editing <code>app/client/entry.ts</code> or <code>app/client/content.ts</code>.
      </p>
      <div id="app-root" class="app" aria-live="polite">
        Loading client app...
      </div>
      <script type="module" src="${escapeHtml(entryUrl)}"></script>
    </main>
  </body>
</html>`

      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    },
    async assets({ request }) {
      let assetResponse = await assetServer.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
  },
})

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}
