import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'

import { compression } from '@remix-run/compression-middleware'
import { createRouter } from '@remix-run/fetch-router'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { staticFiles } from '@remix-run/static-middleware'

let demosDir = path.resolve(import.meta.dirname)

let router = createRouter({
  middleware: [compression(), staticFiles(demosDir)],
})

let html = String.raw

router.get('/', () => {
  let entries = fs.readdirSync(demosDir, { withFileTypes: true })
  let demos = entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
    .map((entry) => entry.name)
    .sort()
  let links = demos.map((name) => `<li><a href="/${name}/index.html">${name}</a></li>`).join('')

  return new Response(
    html`<!doctype html>
      <html>
        <head>
          <title>DOM Demos</title>
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
          <h1>DOM Demos</h1>
          <ul>
            ${links}
          </ul>
        </body>
      </html>`,
    { headers: { 'Content-Type': 'text/html' } },
  )
})

let server = http.createServer(
  createRequestListener(async (request) => await router.fetch(request)),
)

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
