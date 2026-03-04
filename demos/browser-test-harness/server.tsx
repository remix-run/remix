import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { createRequestListener } from 'remix/node-fetch-server'
import { renderToString } from 'remix/component/server'
import { transformFile } from './lib/transform.ts'
import type { RemixNode } from 'remix/component/jsx-runtime'

let __dirname = path.dirname(fileURLToPath(import.meta.url))

let routes = route({
  testRunner: '/_test/:file',
  testModule: '/_module/:path*',
  browserRuntime: '/_browser/:module',
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
let router = createRouter()

router.get(routes.testRunner, async ({ params }) => {
  let testFile = params.file

  let script = `
    try {
      let { setupTestFramework } = await import('/_browser/test-framework.js')
      let { setupAssertions } = await import('/_browser/assertions.js')
      let { runTests } = await import('/_browser/test-executor.js')

      setupTestFramework()
      setupAssertions()

      await import('/_module/${testFile}')

      let results = await runTests()
      window.__testResults = results
      document.getElementById('test-status').textContent =
        results.passed + ' passed, ' + results.failed + ' failed'
    } catch (error) {
      console.error('Error running tests:', error)
      document.getElementById('test-status').textContent = 'Error: ' + error.message
      window.__testResults = { passed: 0, failed: 1, tests: [] }
    }`

  function TestPage() {
    return () => (
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Test: {testFile}</title>
        </head>
        <body>
          <div id="test-status">Running tests...</div>
          <script type="module" innerHTML={script} />
        </body>
      </html>
    )
  }

  return await render.html(<TestPage />)
})

router.get(routes.testModule, async ({ params, url }) => {
  let filePath = decodeURIComponent(url.pathname.slice('/_module/'.length))
  if (!filePath) {
    return new Response('Missing file path', { status: 400 })
  }
  return render.js(await transformFile(filePath))
})

router.get(routes.browserRuntime, async ({ params }) => {
  let modulePath = path.join(__dirname, 'browser', params.module.replace('.js', '.ts'))
  return render.js(await transformFile(modulePath))
})

export async function startServer(port = 44100): Promise<http.Server> {
  let server = http.createServer(createRequestListener(async (req) => await router.fetch(req)))

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on http://localhost:${port}`)
      resolve()
    })
  })

  return server
}
