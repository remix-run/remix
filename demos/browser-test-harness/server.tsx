import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { createRequestListener } from 'remix/node-fetch-server'
import { renderToString } from 'remix/component/server'
import { transformFile, bundleFile } from './lib/transform.ts'
import { discoverTests } from './lib/test-discovery.ts'
import type { RemixNode } from 'remix/component/jsx-runtime'
import { TestStatus } from './browser/test-runner-app.tsx'

let __dirname = path.dirname(fileURLToPath(import.meta.url))

let routes = route({
  testRunner: '/',
  testModule: '/_module/:path*',
  bundleRuntime: '/_bundle/:module',
  transformRuntime: '/_transform/:module',
})

let render = {
  async html(node: RemixNode) {
    return new Response(await renderToString(node), {
      headers: { 'Content-Type': 'text/html' },
    })
  },
  js(src: string) {
    return new Response(src, {
      headers: { 'Content-Type': 'application/javascript' },
    })
  },
}
let testPattern = ''
let allowedTestFiles = new Set<string>()

let router = createRouter()

router.get(routes.testRunner, async () => {
  let absoluteFiles = await discoverTests(testPattern, __dirname)
  let testFiles = absoluteFiles.map((f) => path.relative(__dirname, f))
  allowedTestFiles = new Set(testFiles)

  function TestPage() {
    return () => (
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tests: {testPattern}</title>
        </head>
        <body>
          <TestStatus setup={{ testFiles }} />
          <script type="module" src="/_bundle/entry.js" />
        </body>
      </html>
    )
  }

  return await render.html(<TestPage />)
})

router.get(routes.testModule, async ({ url }) => {
  let filePath = decodeURIComponent(url.pathname.slice('/_module/'.length))
  if (!filePath) {
    return new Response('Missing file path', { status: 400 })
  }
  if (!allowedTestFiles.has(filePath)) {
    return new Response('Forbidden', { status: 403 })
  }
  return render.js(await transformFile(path.resolve(__dirname, filePath)))
})

router.get(routes.bundleRuntime, async ({ params }) => {
  let name = params.module.replace('.js', '')
  let tsxPath = path.join(__dirname, 'browser', name + '.tsx')
  return render.js(await bundleFile(tsxPath))
})

router.get(routes.transformRuntime, async ({ params }) => {
  let name = params.module.replace('.js', '')
  let tsPath = path.join(__dirname, 'browser', name + '.ts')
  return render.js(await transformFile(tsPath))
})

export async function startServer(port = 44100, pattern = ''): Promise<http.Server> {
  testPattern = pattern
  let server = http.createServer(createRequestListener(async (req) => await router.fetch(req)))

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on http://localhost:${port}`)
      resolve()
    })
  })

  return server
}
