import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { renderToString } from '@remix-run/component/server'
import { transformFile, bundleFile } from './transform.ts'
export { clearCache } from './transform.ts'
import { discoverTests } from './test-discovery.ts'
import type { RemixNode } from '@remix-run/component/jsx-runtime'
import { TestStatus } from '../browser/test-status.tsx'

// Directory of this server file, used to resolve browser entry point
let serverDir = path.dirname(fileURLToPath(import.meta.url))

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
let testCwd = ''

let router = createRouter()

// Import map: all @remix-run/* packages routed through /_pkg/ for browser bundling
let importMap = JSON.stringify({
  imports: {
    'remix/': '/_pkg/remix/',
    '@remix-run/': '/_pkg/@remix-run/',
  },
})

router.get(routes.testRunner, async () => {
  let absoluteFiles = await discoverTests(testPattern, testCwd)
  let testFiles = absoluteFiles.map((f) => path.relative(testCwd, f))

  function TestPage() {
    return () => (
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tests: {testPattern}</title>
          <script type={'importmap' as string}>{importMap}</script>
        </head>
        <body>
          <TestStatus setup={{ testFiles, baseDir: testCwd }} />
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
  let resolved = path.resolve(testCwd, filePath)
  if (!resolved.startsWith(testCwd + path.sep)) {
    return new Response('Forbidden', { status: 403 })
  }
  return render.js(await transformFile(resolved))
})

router.get(routes.entry, async () => {
  let entryPath = path.join(serverDir, '../browser/entry.ts')
  return render.js(await bundleFile(entryPath))
})

router.get(routes.pkg, async ({ url }) => {
  // TODO: use params.package once the router's catch-all param extraction is fixed —
  // currently it only returns the first character of the matched segment
  let pkg = url.pathname.slice('/_pkg/'.length)
  if (!pkg.startsWith('remix/') && !pkg.startsWith('@remix-run/')) {
    return new Response('Forbidden', { status: 403 })
  }
  let resolved = fileURLToPath(import.meta.resolve(pkg))
  return render.js(await bundleFile(resolved))
})

export async function startServer(
  port = 44101,
  pattern = '',
  cwd = process.cwd(),
): Promise<http.Server> {
  testPattern = pattern
  testCwd = cwd
  let server = http.createServer(createRequestListener(async (req) => await router.fetch(req)))

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on http://localhost:${port}`)
      resolve()
    })
  })

  return server
}
