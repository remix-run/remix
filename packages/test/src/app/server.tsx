import type { RemixNode } from '@remix-run/component/jsx-runtime'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createScriptServer, type ScriptServerOptions } from '@remix-run/script-server'
import * as http from 'node:http'
import * as path from 'node:path'
import { Tests } from './client/components.tsx'

const routes = route({
  home: '/',
  iframe: '/iframe',
  scripts: '/scripts/*path',
})

export async function startServer(
  absoluteFiles: string[],
): Promise<{ server: http.Server; port: number }> {
  let router = getRouter(absoluteFiles)
  let handler = createRequestListener(async (req) => await router.fetch(req))
  let port = 44101

  let lastError: unknown
  for (let i = 0; i < 5; i++) {
    try {
      let server = http.createServer(handler)
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, () => {
          server.removeListener('error', reject)
          console.log(`Test server running on http://localhost:${port}`)
          resolve()
        })
      })
      return { server, port }
    } catch (error: any) {
      if (error.code !== 'EADDRINUSE') throw error
      lastError = error
      console.log(`Port ${port} is in use, trying another port...`)
      port += 1
    }
  }

  throw lastError
}

function getRouter(absoluteFiles: string[]) {
  let router = createRouter()

  let { scriptServer, testFiles } = getScriptServer(absoluteFiles)

  router.get(routes.scripts, async ({ request, params }) => {
    if (!params.path) return new Response('Not found', { status: 404 })
    let script = await scriptServer.fetch(request)
    return script ?? new Response('Not found', { status: 404 })
  })

  router.get(routes.home, async () =>
    html(
      <Doc title="Tests">
        <Tests setup={{ testFiles, baseDir: process.cwd() }} />
        <script type="module" src={routes.scripts.href({ path: 'app/entry.ts' })} />
      </Doc>,
    ),
  )

  router.get(routes.iframe, async ({ request }) => {
    let test = decodeURIComponent(new URL(request.url).searchParams.get('file') || '')
    return html(
      <Doc title={`Test: ${test}`}>
        <script type="module" src={routes.scripts.href({ path: 'app/iframe.ts' })}></script>
      </Doc>,
    )
  })

  return router
}

function getScriptServer(absoluteFiles: string[]) {
  let isInRemixMonoRepo = false
  let rootDir = process.cwd()

  try {
    let resolvedRemixTestPath = import.meta.resolve('@remix-run/test')
    if (resolvedRemixTestPath.includes('packages/test')) {
      isInRemixMonoRepo = true
      resolvedRemixTestPath = resolvedRemixTestPath.replace('file://', '')
      rootDir = path.relative(
        process.cwd(),
        resolvedRemixTestPath.substring(0, resolvedRemixTestPath.indexOf('packages/test')),
      )
    }
  } catch (e) {}

  let relativeFiles = absoluteFiles.map((f) => path.relative(rootDir, f))
  let testFiles = relativeFiles.map((f) => `/scripts/test/${f}`)
  let opts: ScriptServerOptions = {
    root: rootDir,
    routes: [
      {
        urlPattern: `/scripts/app/*path`,
        filePattern: isInRemixMonoRepo ? 'packages/test/src/app/client/*path' : 'client/*path',
      },
      ...relativeFiles.map((_, i) => ({
        urlPattern: testFiles[i],
        filePattern: relativeFiles[i],
      })),
      {
        urlPattern: `/scripts/*path`,
        filePattern: '*path',
      },
    ],
    allow: ['**', 'node_modules/**', 'node_modules/.pnpm/**'],
    sourceMaps: 'inline',
  }
  let scriptServer = createScriptServer(opts)
  return { scriptServer, testFiles }
}

async function html(node: RemixNode) {
  return new Response(`<!DOCTYPE html>` + (await renderToString(node)), {
    headers: { 'Content-Type': 'text/html' },
  })
}

function Doc() {
  return ({ title, children }: { title: string; children: RemixNode }) => (
    <html>
      <head>
        <meta charset="utf-8" />
        <title>{title}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
