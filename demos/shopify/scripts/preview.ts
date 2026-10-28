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
  createRequestListener((request) => serveAgentGuide(request, fetchFile)),
)

// Like Cloudflare, apply the export's `_headers` rules. They carry the asset server's Content-Type
// and Cache-Control for fingerprinted assets (see scripts/render-site.ts); without them, compiled
// scripts with `.ts` and `.tsx` names would be served as video or binary files.
const headerRules = await readHeaderRules(path.join(directory, '_headers'))

async function fetchFile(request: Request) {
  let response = await router.fetch(decodePath(request))
  let rule = headerRules.get(new URL(request.url).pathname)
  if (!rule) return response
  let headers = new Headers(response.headers)
  for (let [name, value] of rule) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// The export links fingerprinted assets as `styles.%40abc123.css` to avoid Cloudflare redirects
// (see scripts/render-site.ts), while the files on disk are named `styles.@abc123.css`. Like
// Cloudflare, decode the path before looking up the file; staticFiles uses it as written. Remove
// this once https://github.com/remix-run/remix/pull/12113 lands and staticFiles decodes paths.
function decodePath(request: Request) {
  let url = new URL(request.url)
  try {
    url.pathname = decodeURIComponent(url.pathname)
  } catch {
    return request
  }
  return new Request(url, request)
}

// Reads the exact-path rules that scripts/render-site.ts writes: a path, then indented headers.
async function readHeaderRules(file: string) {
  let rules = new Map<string, Array<[string, string]>>()
  let text = await readFile(file, 'utf8').catch(() => '')
  let current: Array<[string, string]> = []
  for (let line of text.split('\n')) {
    if (line.trim() === '') continue
    if (!/^\s/.test(line)) {
      current = []
      rules.set(line.trim(), current)
      continue
    }
    let separator = line.indexOf(':')
    current.push([line.slice(0, separator).trim(), line.slice(separator + 1).trim()])
  }
  return rules
}

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
