import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'

import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { createRequestListener } from 'remix/node-fetch-server'
import { staticFiles } from 'remix/static-middleware'

let demosDir = path.resolve(import.meta.dirname)

let routes = route({
  index: '/',
})

let router = createRouter({
  middleware: [staticFiles('.')],
})

let html = String.raw

router.get(routes.index, () => {
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
          <title>Component Demos</title>
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
          <h1>Component Demos</h1>
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
  console.log('Demos server running at http://localhost:44100')
})

function shutdown() {
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
