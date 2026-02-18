import * as http from 'node:http'
import * as fs from 'node:fs'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter, type Middleware } from '@remix-run/fetch-router'
import { staticFiles } from '@remix-run/static-middleware'
import * as entryAsset from '#assets/app/entry.tsx'
import * as heavyMetalBookAsset from '#assets/app/images/books/heavy-metal-1.png'
import * as threeWaysBookAsset from '#assets/app/images/books/three-ways-1.png'
import { files } from './assets.ts'

let isDev = process.env.NODE_ENV === 'development'

/**
 * Get the middleware required for assets in the current environment.
 *
 * In development: createDevAssets serves source files with on-the-fly transformation
 * and resolves file variants through the files config.
 * In production: assets middleware resolves against the generated manifest, while
 * staticFiles serves the built asset output at /assets.
 */
async function getAssetsMiddleware(): Promise<{
  middleware: Middleware[]
  close(): void
}> {
  if (isDev) {
    let { createDevAssets } = await import('@remix-run/dev-assets-middleware')
    let devAssets = createDevAssets({
      allow: ['app/**', '**/node_modules/**'],
      workspaceRoot: '../..',
      workspaceAllow: ['packages/*/src/**', '**/node_modules/**'],
      scripts: ['app/entry.tsx'],
      files,
    })
    return {
      middleware: [devAssets.middleware],
      close: () => devAssets.close(),
    }
  }

  let { assets } = await import('@remix-run/assets-middleware')
  let manifestPath = './build/assets-manifest.json'
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Build manifest not found at ${manifestPath}. Run "pnpm run build" or "pnpm run build:bundled" before starting in production mode.`,
    )
  }
  let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  return {
    middleware: [
      assets(manifest, { baseUrl: '/assets' }),
      staticFiles('./build/assets', {
        basePath: '/assets',
        cacheControl: 'public, max-age=31536000, immutable',
      }),
    ],
    close() {},
  }
}

async function main() {
  let assets = await getAssetsMiddleware()

  let router = createRouter({
    middleware: [...assets.middleware, staticFiles('./public')],
  })

  // Home page - renders HTML with the entry script
  router.get('/', ({ assets }) => {
    let bbqThumbnail = assets.resolve('app/images/books/bbq-1.png', 'thumbnail')
    let bbqCard = assets.resolve('app/images/books/bbq-1.png', 'card')
    let bbqHero = assets.resolve('app/images/books/bbq-1.png', 'hero')

    // Generate modulepreload links for all preloads
    let preloads = entryAsset.preloads
      .map((preload) => `<link rel="modulepreload" href="${preload}" />`)
      .join('\n    ')

    let html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Assets Middleware Demo</title>
    ${preloads}
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 980px;
        margin: 2rem auto;
        padding: 0 1rem;
      }
      #app {
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
      .gallery {
        margin: 1.25rem 0;
        display: grid;
        gap: 1.5rem;
      }
      .variant-row {
        display: flex;
        align-items: flex-end;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .variant {
        margin: 0;
      }
      .variant img {
        height: auto;
        display: block;
        border-radius: 8px;
      }
      .variant p {
        margin: 0.4rem 0 0;
        font-size: 0.875rem;
        color: #444;
      }
      .muted {
        margin-top: 0;
        color: #555;
      }
    </style>
  </head>
  <body>
    <h1>Assets Demo</h1>
    <p>Mode: <strong>${isDev ? 'Development' : 'Production'}</strong></p>
    <p>${isDev ? 'TypeScript/JSX files are transformed on-the-fly.' : 'Serving pre-built and minified assets.'}</p>
    <div id="app"></div>
    <br />
    <p class="muted">All source PNGs are converted to compressed JPGs by variants. Display width matches transformed variant width.</p>
    <div class="gallery">
      <section>
        <h2>Same source, three variants (dynamic resolve)</h2>
        <div class="variant-row">
          ${bbqThumbnail ? `<figure class="variant"><img src="${bbqThumbnail.href}" width="120" alt="BBQ cover thumbnail variant" /><p>thumbnail: 120w, jpg</p></figure>` : ''}
          ${bbqCard ? `<figure class="variant"><img src="${bbqCard.href}" width="280" alt="BBQ cover card variant" /><p>card: 280w, jpg</p></figure>` : ''}
          ${bbqHero ? `<figure class="variant"><img src="${bbqHero.href}" width="560" alt="BBQ cover hero variant" /><p>hero: 560w, jpg</p></figure>` : ''}
        </div>
      </section>
      <section>
        <h2>Other images using the same variants (static imports)</h2>
        <div class="variant-row">
          <figure class="variant"><img src="${heavyMetalBookAsset.variants.card.href}" width="120" alt="Heavy metal cover thumbnail variant" /><p>heavy-metal-1.png -> thumbnail jpg</p></figure>
          <figure class="variant"><img src="${threeWaysBookAsset.variants.card.href}" width="280" alt="Three ways cover card variant" /><p>three-ways-1.png -> card jpg</p></figure>
        </div>
      </section>
    </div>
    <script type="module" src="${entryAsset.href}"></script>
  </body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  })

  let server = http.createServer(
    createRequestListener(async (request) => {
      try {
        return await router.fetch(request)
      } catch (error) {
        console.error(error)
        return new Response('Internal Server Error', { status: 500 })
      }
    }),
  )

  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

  server.listen(port, () => {
    console.log(`Assets demo is running on http://localhost:${port}`)
    console.log(`Mode: ${isDev ? 'development' : 'production'}`)
  })

  let shuttingDown = false

  function shutdown() {
    console.log('Shutting down server...')
    if (shuttingDown) return
    shuttingDown = true
    assets.close()
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
