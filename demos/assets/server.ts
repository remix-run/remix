import * as http from 'node:http'
import * as fs from 'node:fs'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter } from '@remix-run/fetch-router'
import { staticFiles } from '@remix-run/static-middleware'
import { esbuildConfig } from './esbuild.config.ts'

let isDev = process.env.NODE_ENV === 'development'

/**
 * Get the middleware required for assets in the current environment.
 *
 * In development: devAssets only (on-the-fly TypeScript/JSX transformation).
 * In production: assets middleware (manifest/entry resolution) plus staticFiles
 * for serving the built asset output at /assets (so the app doesn't need to wire
 * static serving separately; CDN setups would use only the assets middleware).
 */
async function getAssetsMiddleware() {
  if (isDev) {
    let { devAssets } = await import('@remix-run/dev-assets-middleware')
    return [
      devAssets({
        allow: ['app/**'],
        workspace: {
          root: '../..',
          allow: ['**/node_modules/**', 'packages/**'],
        },
        esbuildConfig,
      }),
    ]
  }

  let { assets } = await import('@remix-run/assets-middleware')
  let manifestPath = './build/assets-manifest.json'
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Build manifest not found at ${manifestPath}. Run "pnpm run build" or "pnpm run build:bundled" before starting in production mode.`,
    )
  }
  let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  return [
    assets(manifest, {
      baseUrl: '/assets',
    }),
    staticFiles('./build/assets', {
      basePath: '/assets',
      cacheControl: 'public, max-age=31536000, immutable',
    }),
  ]
}

async function main() {
  let assetsMiddleware = await getAssetsMiddleware()

  let router = createRouter({
    middleware: [...assetsMiddleware, staticFiles('./public')],
  })

  // Home page - renders HTML with the entry script
  router.get('/', ({ assets }) => {
    let entry = assets.get('app/entry.tsx')
    if (!entry) {
      return new Response('Entry point not found', { status: 500 })
    }

    // Generate modulepreload links for all chunks
    let preloads = entry.chunks
      .map((chunk) => `<link rel="modulepreload" href="${chunk}" />`)
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
        max-width: 600px;
        margin: 2rem auto;
        padding: 0 1rem;
      }
      #app {
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <h1>Assets Middleware Demo</h1>
    <p>Mode: <strong>${isDev ? 'Development' : 'Production'}</strong></p>
    <p>${isDev ? 'TypeScript/JSX files are transformed on-the-fly.' : 'Serving pre-built and minified assets.'}</p>
    <div id="app"></div>
    <script type="module" src="${entry.href}"></script>
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

  function shutdown() {
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  server.listen(port, () => {
    console.log(`Assets demo is running on http://localhost:${port}`)
    console.log(`Mode: ${isDev ? 'development' : 'production'}`)
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
