import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from '@remix-run/component/server'
import { createContextKey, createRouter, type RequestContext } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { createRequestListener } from '@remix-run/node-fetch-server'
import {
  createScriptServer,
  type ScriptServer,
  type ScriptServerOptions,
} from '@remix-run/script-server'
import { TestResults } from './components.tsx'

// Directory of this server file, used to resolve browser entry point
let serverDir = path.dirname(fileURLToPath(import.meta.url))

let routes = route({
  home: '/',
  scripts: '/scripts/*path',
})

export async function startServer(
  port = 44101,
  absoluteFiles: string[] = [],
): Promise<http.Server> {
  let router = getRouter(absoluteFiles)
  let server = http.createServer(createRequestListener(async (req) => await router.fetch(req)))

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on http://localhost:${port}`)
      resolve()
    })
  })

  return server
}

function getRouter(absoluteFiles: string[]) {
  let router = createRouter({
    middleware: [initializeScriptServer(absoluteFiles)],
  })

  router.get(routes.home, async (context) => {
    let { testFiles } = context.get(scriptServerKey)
    return new Response(
      await renderToString(
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Tests</title>
          </head>
          <body>
            <TestResults setup={{ testFiles, baseDir: process.cwd() }} />
            <script type="module" src={routes.scripts.href({ path: '/entry.ts' })} />
          </body>
        </html>,
      ),
      { headers: { 'Content-Type': 'text/html' } },
    )
  })

  router.get(routes.scripts, async (context) => {
    let { scriptServer } = context.get(scriptServerKey)
    let response = await scriptServer.fetch(context.request)
    return response ?? new Response('Not found', { status: 404 })
  })

  return router
}

let scriptServerKey = createContextKey<{ testFiles: string[]; scriptServer: ScriptServer }>()

function initializeScriptServer(absoluteFiles: string[]) {
  let testFiles: string[] | undefined
  let scriptServer: ScriptServer | undefined

  return async (context: RequestContext) => {
    if (testFiles && scriptServer) {
      context.set(scriptServerKey, { testFiles, scriptServer })
      return
    }

    let relativeFiles = absoluteFiles.map((f) => path.relative(process.cwd(), f))
    let testPrefix = '@test'
    testFiles = relativeFiles.map((f) => routes.scripts.href({ path: `${testPrefix}/${f}` }))

    // TODO: This is messy - how can we clean this up?
    let isInRemixMonorepo = serverDir.endsWith('packages/test/src/app')
    let remixPkgJsonPath = isInRemixMonorepo
      ? path.resolve(serverDir, '../../../../packages/remix/package.json')
      : fileURLToPath(import.meta.resolve('remix/package.json'))
    let remixDir = path.dirname(remixPkgJsonPath)

    let remixPkgJson = JSON.parse(await fs.readFile(remixPkgJsonPath, 'utf-8'))
    let remixPackages = Object.keys(remixPkgJson.dependencies).filter((dep: string) =>
      dep.startsWith('@remix-run/'),
    )

    let opts: ScriptServerOptions = {
      base: '/scripts',
      roots: [
        {
          directory: serverDir,
          entryPoints: ['entry.ts'],
        },
        {
          prefix: '/@app',
          directory: serverDir,
        },
        {
          prefix: '/@lib',
          directory: path.join(serverDir, '../lib'),
        },
        // Entrypoint per test module
        {
          prefix: testPrefix,
          directory: process.cwd(),
          entryPoints: relativeFiles,
        },
        // User-code will import from `remix/*`
        {
          prefix: '/@pkg/remix',
          directory: remixDir,
        },
        // And remix will import from `@remix-run/*`
        ...remixPackages.map((pkg: string) => ({
          prefix: `/@pkg/${pkg}`,
          directory: path.join(remixDir, `/node_modules/${pkg}`),
        })),
        // User node_modules
        // TODO: This may need to be configurable by users...
        {
          prefix: '/@pkg',
          directory: path.join(process.cwd(), '../../node_modules'),
        },
      ],
      external: ['@remix-run/*', 'remix/*'],
      sourceMaps: 'inline',
    }

    scriptServer = createScriptServer(opts)

    context.set(scriptServerKey, { testFiles, scriptServer })
  }
}
