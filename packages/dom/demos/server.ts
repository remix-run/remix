import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'

let demosDir = path.resolve(import.meta.dirname)

let server = http.createServer((request, response) => {
  let url = request.url ?? '/'
  if (url === '/') {
    writeIndex(response, demosDir)
    return
  }

  let safePath = sanitizePath(url)
  if (!safePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain' })
    response.end('Bad request')
    return
  }

  let filePath = path.join(demosDir, safePath)
  if (!filePath.startsWith(demosDir)) {
    response.writeHead(403, { 'Content-Type': 'text/plain' })
    response.end('Forbidden')
    return
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain' })
      response.end('Not found')
      return
    }
    response.writeHead(200, { 'Content-Type': contentTypeFor(filePath) })
    response.end(file)
  })
})

server.listen(44100, () => {
  console.log('DOM demos server running at http://localhost:44100')
})

function shutdown() {
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function writeIndex(response: http.ServerResponse, rootDir: string) {
  let entries = fs.readdirSync(rootDir, { withFileTypes: true })
  let demos = entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
    .map((entry) => entry.name)
    .sort()
  let links = demos.map((name) => `<li><a href="/${name}/index.html">${name}</a></li>`).join('')
  let page = `<!doctype html>
<html>
  <head>
    <title>DOM Demos</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
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
    <h1>DOM Demos</h1>
    <ul>${links}</ul>
  </body>
</html>`
  response.writeHead(200, { 'Content-Type': 'text/html' })
  response.end(page)
}

function sanitizePath(value: string) {
  let pathname = value.split('?')[0] ?? '/'
  if (pathname.includes('\0')) return null
  let normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  return normalized.startsWith('/') ? normalized.slice(1) : normalized
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.js')) return 'text/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}
