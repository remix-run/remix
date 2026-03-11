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
import { TestStatus } from './browser/test-status.tsx'

let __dirname = path.dirname(fileURLToPath(import.meta.url))

let routes = route({
  testRunner: '/',
  entry: '/entry.js',
  testModule: '/_module/:path*',
  pkg: '/_pkg/:package*',
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

let router = createRouter()

let importMap = JSON.stringify({ imports: { 'remix/': '/_pkg/remix/' } })

router.get(routes.testRunner, async () => {
  let absoluteFiles = await discoverTests(testPattern, __dirname)
  let testFiles = absoluteFiles.map((f) => path.relative(__dirname, f))

  function TestPage() {
    return () => (
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tests: {testPattern}</title>
          <script type={'importmap' as string}>{importMap}</script>
        </head>
        <body>
          <TestStatus setup={{ testFiles, baseDir: __dirname }} />
          <script type="module" src="/entry.js" />
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
  let resolved = path.resolve(__dirname, filePath)
  if (!resolved.startsWith(__dirname + path.sep)) {
    return new Response('Forbidden', { status: 403 })
  }
  return render.js(await transformFile(resolved))
})

router.get(routes.entry, async () => {
  let entryPath = path.join(__dirname, 'browser', 'entry.ts')
  return render.js(await bundleFile(entryPath))
})

router.get(routes.pkg, async ({ url }) => {
  // TODO: use params.package once the router's catch-all param extraction is fixed —
  // currently it only returns the first character of the matched segment
  let pkg = url.pathname.slice('/_pkg/'.length)
  if (!pkg.startsWith('remix/')) {
    return new Response('Forbidden', { status: 403 })
  }
  let resolved = fileURLToPath(import.meta.resolve(pkg))
  return render.js(await bundleFile(resolved))
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
