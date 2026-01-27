import * as http from 'node:http'
import * as fs from 'node:fs'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter, type Middleware } from '@remix-run/fetch-router'
import { staticFiles } from '@remix-run/static-middleware'
import { esbuildConfig } from './esbuild.config.ts'

let isDev = process.env.NODE_ENV === 'development'

/**
 * Get the assets middleware based on the environment.
 *
 * In development: Uses devAssets for on-the-fly TypeScript/JSX transformation
 * In production: Uses prodAssets with a pre-built manifest
 */
async function getAssetsMiddleware(): Promise<Middleware> {
  if (isDev) {
    // Dynamic import to avoid bundling heavy dev deps in production
    let { devAssets } = await import('@remix-run/dev-assets-middleware')
    // Use project root so paths match esbuild's entry points (e.g., 'app/entry.tsx')
    return devAssets({
      hmr: true,
      allow: [/^app\//],
      workspace: {
        // Root is the monorepo root (two levels up from demos/assets-spike)
        root: '../..',
        // Allow serving from node_modules and workspace packages
        allow: [/node_modules/, /^packages\//],
      },
      // Use shared esbuild config for dev/prod parity
      esbuildConfig,
    })
  } else {
    // Production mode: use pre-built assets with manifest
    let { assets } = await import('@remix-run/assets-middleware')

    // Load the manifest from the build
    let metafilePath = './build/metafile.json'
    if (!fs.existsSync(metafilePath)) {
      throw new Error(
        `Build manifest not found at ${metafilePath}. ` +
          `Run "pnpm run build" before starting in production mode.`,
      )
    }

    let manifest = JSON.parse(fs.readFileSync(metafilePath, 'utf-8'))
    return assets(manifest)
  }
}

async function main() {
  let assetsMiddleware = await getAssetsMiddleware()

  let router = createRouter({
    middleware: [
      assetsMiddleware,

      // In production, serve built assets from build/ directory
      // Using filter to only serve files under /build/ path
      // TODO: Replace with basePath option once static-middleware supports it
      ...(isDev ? [] : [staticFiles('.', { filter: (path) => path.startsWith('build/') })]),

      // Serve static files (CSS, images, etc.)
      staticFiles('./public'),
    ],
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
    <title>Assets Middleware Spike</title>
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
    <h1>Assets Middleware Spike</h1>
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
    console.log(`Assets spike demo is running on http://localhost:${port}`)
    console.log(`Mode: ${isDev ? 'development' : 'production'}`)
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
