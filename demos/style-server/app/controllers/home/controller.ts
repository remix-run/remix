import * as path from 'node:path'
import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { styleServer } from '../../utils/style-server.ts'

const entryFilePath = path.resolve(import.meta.dirname, '../../styles/app.css')

export const homeController = {
  async handler() {
    let entryUrl = await styleServer.getHref(entryFilePath)
    let preloadUrls = (await styleServer.getPreloads(entryFilePath)).filter(
      (url: string) => url !== entryUrl,
    )

    let html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>style-server demo</title>
    ${preloadUrls
      .map((url) => `<link rel="preload" as="style" href="${escapeHtml(url)}">`)
      .join('\n    ')}
    <link rel="stylesheet" href="${escapeHtml(entryUrl)}">
  </head>
  <body>
    <main class="layout">
      <div class="eyebrow">remix/style-server</div>
      <h1>Live CSS imports in watch mode</h1>
      <p class="lede">
        This page is styled by a source stylesheet served through
        <code>remix/style-server</code>.
      </p>
      <div class="card">
        <strong>Try editing:</strong>
        <code>app/styles/app.css</code>,
        <code>app/styles/tokens.css</code>, or
        <code>app/styles/card.css</code>.
      </div>
      <p class="note">
        Refresh after each edit to verify the server is serving updated styles without a restart.
      </p>
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
