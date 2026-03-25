import * as path from 'node:path'
import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { scriptServer } from '../../utils/script-server.ts'

let entryFilePath = path.resolve(import.meta.dirname, '../../client/entry.ts')

export let homeController = {
  async handler() {
    let entryUrl = await scriptServer.getHref(entryFilePath)
    let preloadUrls = await scriptServer.getPreloads(entryFilePath)
    let preloadLinks = preloadUrls
      .map((url) => `<link rel="modulepreload" href="${escapeHtml(url)}">`)
      .join('\n')

    let html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>script-server demo</title>
    ${preloadLinks}
    <style>
      :root {
        color-scheme: dark;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }

      body {
        margin: 0;
        background: #0b1020;
        color: #f8fafc;
      }

      main {
        max-width: 60rem;
        margin: 0 auto;
        padding: 3rem 1.5rem 4rem;
      }

      h1, h2 {
        margin: 0 0 1rem;
      }

      p {
        line-height: 1.6;
      }

      .panel {
        background: #11182b;
        border: 1px solid #24304d;
        border-radius: 1rem;
        padding: 1rem 1.25rem;
        margin-top: 1rem;
      }

      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        margin-top: 1.5rem;
      }

      .eyebrow {
        color: #7dd3fc;
        font-size: 0.9rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.95em;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        background: #38bdf8;
        color: #082f49;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        padding: 0.7rem 1rem;
      }

      button:hover {
        background: #7dd3fc;
      }

      ul {
        padding-left: 1.25rem;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Client-only demo</p>
      <h1>script-server watch mode</h1>
      <p>
        This page is rendered once on the server and then hydrated entirely by browser
        modules served through <code>remix/script-server</code>. The Node process stays
        alive in development so you can manually test watch-mode invalidation.
      </p>

      <div id="app-root" class="panel" aria-live="polite">
        Loading client app...
      </div>

      <section class="grid" aria-label="Manual test ideas">
        <article class="panel">
          <h2>Edit a source file</h2>
          <p>Update <code>app/client/entry.ts</code> or <code>app/client/lazy-panel.ts</code>, then refresh.</p>
        </article>

        <article class="panel">
          <h2>Test extensionless resolution</h2>
          <p>
            The client imports <code>./live-copy</code> without an extension. Start with
            <code>app/client/live-copy.js</code>, then add <code>app/client/live-copy.ts</code>
            and refresh to see the higher-priority file win.
          </p>
        </article>

        <article class="panel">
          <h2>Test package metadata</h2>
          <p>
            Flip <code>app/node_modules/demo-copy/package.json</code> from
            <code>./v1.ts</code> to <code>./v2.ts</code> and refresh.
          </p>
        </article>
      </section>

      <script type="module" src="${entryUrl}"></script>
    </main>
  </body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  },
} satisfies BuildAction<'GET', typeof routes.home>

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}
