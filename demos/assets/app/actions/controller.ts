import * as path from 'node:path'
import type { Controller } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { assetServer } from '../utils/assets.ts'

const entryFilePath = path.resolve(import.meta.dirname, '../client/entry.ts')
const styleFilePath = path.resolve(import.meta.dirname, '../client/styles/app.css')
const imageFilePath = path.resolve(import.meta.dirname, '../client/images/image.svg')

export default {
  actions: {
    async home() {
      let entryUrl = await assetServer.getHref(entryFilePath)
      let imageUrl = await assetServer.getHref(imageFilePath)
      let styleUrl = await assetServer.getHref(styleFilePath)
      let transformedImageUrl = await assetServer.getHref(imageFilePath, {
        transform: [['recolor', '#8B5CF6']],
      })

      let html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>remix/assets demo</title>
    <link rel="stylesheet" href="${escapeHtml(styleUrl)}">
  </head>
  <body>
    <main class="page-shell">
      <h1>remix/assets watch mode</h1>
      <p>
        This server stays running while <code>remix/assets</code> watches client files.
        Edit a client module, refresh the page, and the updated code is served without
        restarting the server.
      </p>
      <p>
        This page serves a static SVG directly in HTML and also references the same SVG from
        compiled CSS with <code>url(...)</code>.
      </p>
      <p>
        It also requests a transformed SVG variant through the
        <code>transform</code> query parameter to demonstrate request transforms and
        transformed-output caching.
      </p>
      <p>
        Try editing <code>app/client/entry.ts</code>, <code>app/client/styles/app.css</code>,
        or <code>app/client/images/image.svg</code>. You can also tweak the transforms in
        <code>app/utils/assets.ts</code>.
      </p>
      <div id="app-root" class="app" aria-live="polite">
        Loading client app...
      </div>
      <div class="asset-previews" aria-label="Static asset previews">
        <figure class="asset-preview">
          <img
            class="asset-image"
            src="${escapeHtml(imageUrl)}"
            alt="Simple demo image"
            width="120"
            height="120"
          >
          <figcaption>Direct HTML image</figcaption>
        </figure>
        <figure class="asset-preview">
          <img
            class="asset-image"
            src="${escapeHtml(transformedImageUrl)}"
            alt="Purple transformed demo image"
            width="120"
            height="120"
          >
          <figcaption>Request-transformed image</figcaption>
        </figure>
        <figure class="asset-preview">
          <div class="asset-background" aria-hidden="true"></div>
          <figcaption>CSS background image</figcaption>
        </figure>
        <figure class="asset-preview">
          <div class="asset-background asset-background-request-transformed" aria-hidden="true"></div>
          <figcaption>CSS request-transformed background image</figcaption>
        </figure>
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
} satisfies Controller<typeof routes>

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}
