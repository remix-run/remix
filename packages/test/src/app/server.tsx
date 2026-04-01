import * as http from 'node:http'
import * as path from 'node:path'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createScriptServer, type ScriptServer } from '@remix-run/script-server'
import { Tests } from './client/components.tsx'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')

const routes = route({
  home: '/',
  iframe: '/iframe',
  scripts: '/scripts/*path',
})

export async function startServer(
  port: number,
  absoluteFiles: string[],
  retry = false,
): Promise<{ server: http.Server; port: number }> {
  let router = getRouter(absoluteFiles)
  let handler = createRequestListener(async (req) => await router.fetch(req))
  let altPort = () => port + 1 + Math.floor(Math.random() * 99)

  let ports = retry ? [port, altPort(), altPort()] : [port]

  let lastError: unknown
  for (let port of ports) {
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
      let next = ports[ports.indexOf(port) + 1]
      if (next !== undefined) {
        console.log(`Port ${port} is in use, trying ${next}...`)
      }
    }
  }

  throw lastError
}

function getRouter(absoluteFiles: string[]) {
  let router = createRouter()

  let relativeFiles = absoluteFiles.map((f) => path.relative(process.cwd(), f))
  let repoRelativeFiles = absoluteFiles.map((f) => path.relative(repoRoot, f))
  let testFiles = relativeFiles.map((f) => `/scripts/test/${f}`)

  let scriptServer = createScriptServer({
    root: repoRoot,
    routes: [
      {
        urlPattern: `/scripts/app/*path`,
        filePattern: 'packages/test/src/app/client/*path',
      },
      ...relativeFiles.map((f, i) => ({
        urlPattern: testFiles[i],
        filePattern: repoRelativeFiles[i],
      })),
      {
        urlPattern: `/scripts/packages/*path`,
        filePattern: 'packages/*path',
      },
      {
        urlPattern: `/scripts/npm/*path`,
        filePattern: 'node_modules/.pnpm/*path',
      },
    ],
    allow: [
      // TODO: Should only need these if we're running in the remix monorepo?
      'packages/*/src/**',
      // node_modules/** doesn't work here - I don't think the globbing plays nice with .pnpm/
      'node_modules/.pnpm/**',
      'node_modules/**',
    ],
    sourceMaps: 'inline',
  })

  router.get(
    routes.home,
    async () =>
      new Response(
        `<!DOCTYPE html>` +
          (await renderToString(
            <html>
              <head>
                <meta charset="utf-8" />
                <title>Tests</title>
              </head>
              <body>
                <Tests setup={{ testFiles, baseDir: process.cwd() }} />
                <script type="module" src={routes.scripts.href({ path: 'app/entry.ts' })} />
              </body>
            </html>,
          )),
        { headers: { 'Content-Type': 'text/html' } },
      ),
  )

  router.get(routes.iframe, async ({ request }) => {
    let test = decodeURIComponent(new URL(request.url).searchParams.get('file') || '')
    return new Response(
      `<!DOCTYPE html>` +
        (await renderToString(
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Test:{test}</title>
            </head>
            <body>
              <script
                type="module"
                src={routes.scripts.href({ path: 'app/iframe-entry.ts' })}
              ></script>
            </body>
          </html>,
        )),
      { headers: { 'Content-Type': 'text/html' } },
    )
  })

  router.get(routes.scripts, async ({ request, params }) => {
    if (!params.path) return new Response('Not found', { status: 404 })
    let script = await scriptServer.fetch(request)
    return script ?? new Response('Not found', { status: 404 })
  })

  return router
}
