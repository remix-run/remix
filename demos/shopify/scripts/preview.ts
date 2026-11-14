import * as http from 'node:http'
import * as path from 'node:path'
import { access, readFile } from 'node:fs/promises'
import { staticFiles } from 'remix/middleware/static'
import { createRequestListener } from 'remix/node-fetch-server'
import { createRouter } from 'remix/router'

import { serveAgentGuide } from '../app/utils/agent-response.ts'

const directory = path.resolve(import.meta.dirname, '../dist')

try {
  await access(path.join(directory, 'index.html'))
} catch {
  throw new Error('Run pnpm prerender before starting the static preview.')
}

const notFound = await readFile(path.join(directory, '404.html'), 'utf8')
const router = createRouter({
  middleware: [staticFiles(directory)],
  defaultHandler() {
    return new Response(notFound, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  },
})
const server = http.createServer(
  createRequestListener((request) => serveAgentGuide(request, router.fetch)),
)
const port = Number(process.env.PORT ?? 44100)

server.listen(port, () => {
  console.log(`Static Shopify demo is running on http://localhost:${port}`)
})

function shutdown() {
  server.close()
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
