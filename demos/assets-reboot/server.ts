import * as http from 'node:http'
import * as path from 'node:path'
import sharp from 'sharp'
import { openLazyFile } from '@remix-run/fs'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter } from '@remix-run/fetch-router'
import { createFileCache } from '@remix-run/file-cache'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import { createFileResponse } from '@remix-run/response/file'
import { createScriptHandler } from '@remix-run/script-handler'
import { staticFiles } from '@remix-run/static-middleware'
import { routes } from './app/routes.ts'

let isDev = process.env.NODE_ENV === 'development'

let scripts = createScriptHandler({
  entryPoints: ['app/entry.tsx', 'app/worker.ts'] as const,
  root: import.meta.dirname,
  workspaceRoot: '../..',
  base: '/scripts',
})

let imageCache = createFileCache(createFsFileStorage('./tmp/image-cache'), {
  maxSize: 100 * 1024 * 1024,
})

await imageCache.prune()

let imageVariants = {
  thumbnail: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(120)
      .jpeg({ quality: 55, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
  card: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(280)
      .jpeg({ quality: 62, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
  hero: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(560)
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
}

function isImageVariant(value: string): value is keyof typeof imageVariants {
  return value in imageVariants
}

let router = createRouter({
  middleware: [staticFiles('./public')],
})

router.get(routes.scripts, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })
  return (await scripts.handle(request, params.path)) ?? new Response('Not found', { status: 404 })
})

router.get(routes.images, async ({ request, params }) => {
  if (!params.path) return new Response('Not found', { status: 404 })

  let sourceFile: File
  try {
    sourceFile = openLazyFile(path.join(import.meta.dirname, 'app/images', params.path))
  } catch {
    return new Response('Not found', { status: 404 })
  }

  let variantName = new URL(request.url).searchParams.get('variant') ?? 'card'
  if (!isImageVariant(variantName)) {
    return new Response('Unknown variant', { status: 400 })
  }

  let result = await imageCache.getOrSet([sourceFile, variantName], () =>
    imageVariants[variantName](sourceFile),
  )
  return createFileResponse(result, request, { cacheControl: 'no-cache' })
})

router.get(routes.home, async () => {
  let entry = {
    href: routes.scripts.href({ path: 'app/entry.tsx' }),
    preloads: scripts.preloads('app/entry.tsx'),
  }

  let html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Assets Reboot Demo</title>
    ${(await entry.preloads)
      .map((href) => `<link rel="modulepreload" href="${href}" />`)
      .join('\n    ')}
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
        color: #555;
      }
      code {
        background: #f5f5f5;
        padding: 0.1em 0.3em;
        border-radius: 3px;
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
    <h1>Assets Reboot Demo</h1>
    <p>Mode: <strong>${isDev ? 'Development' : 'Production'}</strong></p>
    <p>
      TypeScript/JSX is compiled on demand. Images are transformed on first request
      and cached in file storage via <code>createFileCache</code>. No build step required.
    </p>

    <div id="app"></div>

    <hr />
    <section>
      <h2>Image variants (<code>createFileCache</code>)</h2>
      <p class="muted">
        All source PNGs are converted to compressed JPGs by Sharp variants.
        Width matches the variant size.
      </p>
      <div class="gallery">
        <section>
          <h3>Same source image, three variants</h3>
          <div class="variant-row">
            <figure class="variant">
              <img src="${routes.images.href({ path: 'books/bbq-1.png' }, { variant: 'thumbnail' })}" width="120" alt="BBQ cover thumbnail" />
              <p>thumbnail: 120w jpg</p>
            </figure>
            <figure class="variant">
              <img src="${routes.images.href({ path: 'books/bbq-1.png' }, { variant: 'card' })}" width="280" alt="BBQ cover card" />
              <p>card: 280w jpg (default)</p>
            </figure>
            <figure class="variant">
              <img src="${routes.images.href({ path: 'books/bbq-1.png' }, { variant: 'hero' })}" width="560" alt="BBQ cover hero" />
              <p>hero: 560w jpg</p>
            </figure>
          </div>
        </section>
        <section>
          <h3>Other images using default variant</h3>
          <div class="variant-row">
            <figure class="variant">
              <img src="${routes.images.href({ path: 'books/heavy-metal-1.png' }, { variant: 'card' })}" width="280" alt="Heavy metal cover card" />
              <p>heavy-metal-1.png → card jpg</p>
            </figure>
            <figure class="variant">
              <img src="${routes.images.href({ path: 'books/three-ways-1.png' }, { variant: 'card' })}" width="280" alt="Three ways cover card" />
              <p>three-ways-1.png → card jpg</p>
            </figure>
          </div>
        </section>
      </div>
    </section>

    <hr />
    <section>
      <h2>Web Worker (<code>createScriptHandler</code>)</h2>
      <p>
        The entry point spawns a worker from <code>${routes.scripts.href({ path: 'app/worker.ts' })}</code>.
      </p>
      <p id="worker-result">Computing fib(42) in worker…</p>
    </section>

    <script type="module" src="${entry.href}"></script>
  </body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error('Request error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

server.listen(port, () => {
  console.log(`Assets reboot demo running on http://localhost:${port}`)
  console.log(`Mode: ${isDev ? 'development' : 'production'}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
