import type { RemixNode } from '@remix-run/component/jsx-runtime'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createAssetServer, type AssetServerOptions } from '@remix-run/assets'
import * as http from 'node:http'
import * as path from 'node:path'
import { IS_RUNNING_FROM_SRC } from '../lib/config.ts'
import { Tests } from './client/components.tsx'
import { routes } from './client/routes.ts'

export async function startServer(
  browserFiles: string[],
): Promise<{ server: http.Server; port: number }> {
  let router = getRouter(browserFiles)
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

function getRouter(browserFiles: string[]) {
  let router = createRouter()

  let { scriptServer, testPaths } = getScriptServer(browserFiles)

  router.get(routes.scripts, async ({ request, params }) => {
    if (!params.path) return new Response('Not found', { status: 404 })
    let script = await scriptServer.fetch(request)
    if (script) {
      return script
    } else {
      console.error(`[remix-test] Script not found: ${new URL(request.url).pathname}`)
      return new Response('Not found', { status: 404 })
    }
  })

  router.get(routes.home, async () =>
    html(
      <Doc title="Tests">
        <Tests setup={{ testPaths, baseDir: process.cwd() }} />
        <script
          type="module"
          src={routes.scripts.href({
            path: IS_RUNNING_FROM_SRC ? `app/entry.ts` : `app/entry.js`,
          })}
        />
      </Doc>,
    ),
  )

  router.get(routes.iframe, async ({ request }) => {
    let test = decodeURIComponent(new URL(request.url).searchParams.get('file') || '')
    return html(
      <Doc title={`Test: ${test}`}>
        <script
          type="module"
          src={routes.scripts.href({
            path: IS_RUNNING_FROM_SRC ? `app/iframe.ts` : `app/iframe.js`,
          })}
        ></script>
      </Doc>,
    )
  })

  return router
}

function getScriptServer(browserFiles: string[]) {
  let resolvedRemixTestPath = import.meta.resolve('@remix-run/test').replace('file://', '')
  let rootDir: string
  let clientDir: string

  if (IS_RUNNING_FROM_SRC) {
    let idx = resolvedRemixTestPath.lastIndexOf(path.join('packages', 'test'))
    if (idx === -1) {
      throw new Error(`Could not determine root directory from path: ${resolvedRemixTestPath}`)
    }
    rootDir = resolvedRemixTestPath.substring(0, idx - 1)
    let appDir = path.dirname(import.meta.url.replace('file://', ''))
    clientDir = path.relative(rootDir, path.join(appDir, 'client'))
  } else {
    rootDir = process.cwd()
    let remixTestDistPath = path.dirname(resolvedRemixTestPath)
    clientDir = path.relative(process.cwd(), path.join(remixTestDistPath, 'app', 'client'))
  }

  let relativeFiles = browserFiles.map((f) => path.relative(rootDir, f))
  let testPaths = relativeFiles.map((f) => `/scripts/test/${f}`)
  let opts: AssetServerOptions = {
    rootDir,
    fileMap: {
      [`/scripts/app/*path`]: `${clientDir}/*path`,
      [`/scripts/test/*path`]: '*path',
      [`/scripts/*path`]: '*path',
      ...relativeFiles.reduce(
        (acc, _, i) =>
          Object.assign(acc, {
            [testPaths[i]]: relativeFiles[i],
          }),
        {},
      ),
    },
    allow: ['**', 'node_modules/**', 'node_modules/.pnpm/**'],
    watch: false,
    scripts: {
      sourceMaps: 'inline',
    },
    onError(error) {
      console.error(`[remix-test] Error serving asset: ${error}`)
    },
  }
  let scriptServer = createAssetServer(opts)
  return { scriptServer, testPaths }
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
