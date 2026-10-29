import { html, type SafeHtml } from 'remix/html-template'

import { routes } from '../routes.ts'

// The root controller has no renderer installed, so this page is a plain HTML template.
export function HomePage(): SafeHtml {
  return html`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Renderers</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <main>
          <header>
            <p class="eyebrow">Remix without remix/ui</p>
            <h1>Renderers</h1>
            <p>
              The same guestbook, rendered by a different view library under each route prefix. Each
              controller installs its own <code>context.render()</code> with
              <code>renderWith()</code>.
            </p>
          </header>
          <ol class="entries">
            <li>
              <a href="${routes.preact.guestbook.href()}">Preact</a>
              <p>Served from <code>node_modules</code> by the Remix asset server.</p>
            </li>
            <li>
              <a href="${routes.react.guestbook.href()}">React</a>
              <p>Loaded through an import map from <code>esm.unpkg.com</code>.</p>
            </li>
          </ol>
        </main>
      </body>
    </html>
  `
}
