import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'

const PORT = 44100
const frameworksDir = path.resolve(import.meta.dirname, 'frameworks')

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
])

function html(strings: TemplateStringsArray, ...values: string[]) {
  return String.raw({ raw: strings }, ...values)
}

async function getFrameworkNames(): Promise<string[]> {
  let entries = await fs.readdir(frameworksDir, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}

function getContentType(filePath: string): string {
  return contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream'
}

function resolveFrameworkPath(urlPathname: string): string | null {
  let relativePath = urlPathname.replace(/^\/+/, '')
  if (relativePath === '') return null

  let absolutePath = path.resolve(frameworksDir, relativePath)
  if (absolutePath !== frameworksDir && !absolutePath.startsWith(frameworksDir + path.sep)) {
    return null
  }

  return absolutePath
}

async function serveIndex(response: http.ServerResponse): Promise<void> {
  let frameworks = await getFrameworkNames()
  let links = frameworks.map(name => `<li><a href="/${name}/index.html">${name}</a></li>`).join('')

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(
    html`<!doctype html>
      <html>
        <head>
          <title>Benchmarks</title>
          <style>
            body {
              font-family:
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
              max-width: 600px;
              margin: 40px auto;
              padding: 0 20px;
            }
            h1 {
              margin-bottom: 24px;
            }
            ul {
              list-style: none;
              padding: 0;
            }
            li {
              margin: 8px 0;
            }
            a {
              color: #337ab7;
              text-decoration: none;
              font-size: 18px;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <h1>Benchmarks</h1>
          <ul>
            ${links}
          </ul>
        </body>
      </html>`,
  )
}

async function serveStaticFile(
  filePath: string,
  response: http.ServerResponse,
): Promise<void> {
  let resolvedPath = filePath
  let stats = await fs.stat(resolvedPath)

  if (stats.isDirectory()) {
    resolvedPath = path.join(resolvedPath, 'index.html')
    stats = await fs.stat(resolvedPath)
  }

  if (!stats.isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  let file = await fs.readFile(resolvedPath)
  response.writeHead(200, { 'Content-Type': getContentType(resolvedPath) })
  response.end(file)
}

let server = http.createServer(async (request, response) => {
  try {
    let url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (url.pathname === '/') {
      await serveIndex(response)
      return
    }

    let filePath = resolveFrameworkPath(decodeURIComponent(url.pathname))
    if (filePath == null) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    await serveStaticFile(filePath, response)
  } catch (error) {
    let code = error instanceof Error && 'code' in error ? error.code : null
    if (code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal server error')
  }
})

server.listen(PORT, () => {
  console.log(`Benchmark server running at http://localhost:${PORT}`)
})

function shutdown() {
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
