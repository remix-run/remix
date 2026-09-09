import { createTestServer } from '@remix-run/node-fetch-server/test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lexerPath = fileURLToPath(import.meta.resolve('es-module-lexer'))

export async function createErrorTestServer() {
  return createTestServer(async (request) => {
    let url = new URL(request.url)
    if (url.pathname === '/dynamic-import-failure') return html(dynamicImportFailureDocument)
    if (url.pathname === '/load-error') return html(loadErrorDocument)
    if (url.pathname === '/dist/index.js') return file('dist/index.js')
    if (url.pathname.startsWith('/dist/lib/')) return file(url.pathname.slice(1))
    if (url.pathname === '/vendor/es-module-lexer.js') {
      return javascript(await fs.readFile(lexerPath, 'utf8'))
    }
    if (url.pathname === '/load-non-existent.js') {
      return javascript("import '/non-existent.js'; if (false) import('./' + 'unused.js')")
    }
    return new Response('Not Found', { status: 404, statusText: 'Not Found' })
  })
}

const dynamicImportFailureDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { importShim } from '/dist/index.js'

    let nativeFailed = false
    try {
      await import('/does-not-exist.js')
    } catch {
      nativeFailed = true
    }

    let shimFailed = false
    try {
      await importShim('/does-not-exist.js')
    } catch {
      shimFailed = true
    }
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="result">' + (nativeFailed && shimFailed) + '</div>',
    )
  </script>
</body>
</html>
`

const loadErrorDocument = `
<!doctype html>
<html>
<head>
  <script type="importmap">${JSON.stringify({ imports: { 'es-module-lexer': '/vendor/es-module-lexer.js' } })}</script>
</head>
<body>
  <script type="module">
    import { importShim } from '/dist/index.js'

    try {
      await importShim('/load-non-existent.js')
    } catch (error) {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="error">' + error.toString() + '</div>' +
        '<div id="response">' + (error.response instanceof Response) + '</div>',
      )
    }
  </script>
</body>
</html>
`

async function file(relativePath: string): Promise<Response> {
  return javascript(await fs.readFile(path.join(packageDirectory, relativePath), 'utf8'))
}

function html(source: string): Response {
  return new Response(source, { headers: { 'Content-Type': 'text/html' } })
}

function javascript(source: string): Response {
  return new Response(source, { headers: { 'Content-Type': 'application/javascript' } })
}
