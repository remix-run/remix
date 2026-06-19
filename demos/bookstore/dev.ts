import * as http from 'node:http'

import { createFetchProxy } from 'remix/fetch-proxy'
import { run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

const originPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100
const childPort = process.env.CHILD_PORT ? parseInt(process.env.CHILD_PORT, 10) : originPort + 1
const proxyRetryMethods = ['GET', 'HEAD']
const proxyRetryStatusCodes = [502, 503, 504]
const proxyResponseHeadersToStrip = ['Content-Encoding', 'Content-Length', 'Transfer-Encoding']

const hmrRunner = run('server.ts', {
  env: {
    ...process.env,
    ORIGIN_PORT: String(originPort),
    PORT: String(childPort),
  },
  nodeArgs: ['--import', 'remix/node-tsx'],
  browserEventController: true,
})

const proxyFetch = createFetchProxy(`http://127.0.0.1:${childPort}`, {
  xForwardedHeaders: true,
})

const server = http.createServer(createRequestListener((request) => fetchWhenReady(request)))

server.listen(originPort, '127.0.0.1', () => {
  console.log(`Bookstore dev proxy is running on http://localhost:${originPort}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => hmrRunner.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

function createProxyRequest(request: Request): Request {
  return new Request(request.url, {
    body: request.body,
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    signal: request.signal,
    ...getRequestDuplex(request),
  })
}

async function fetchWhenReady(request: Request): Promise<Response> {
  while (true) {
    await hmrRunner.ready()
    let generation = hmrRunner.generation
    let response: Response

    try {
      response = normalizeProxyResponse(await proxyFetch(createProxyRequest(request)))
    } catch (error) {
      await hmrRunner.ready()
      if (shouldRetryProxyRequest(request) && hmrRunner.generation !== generation) {
        continue
      }
      throw error
    }

    if (!shouldRetryProxyResponse(request, response)) {
      return response
    }
    await hmrRunner.ready()
    if (hmrRunner.generation !== generation) continue
    return response
  }
}

function normalizeProxyResponse(response: Response): Response {
  let headers = new Headers(response.headers)
  for (let header of proxyResponseHeadersToStrip) {
    headers.delete(header)
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function getRequestDuplex(request: Request): { duplex: 'half' } | undefined {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  return { duplex: 'half' }
}

function shouldRetryProxyRequest(request: Request): boolean {
  return proxyRetryMethods.includes(request.method)
}

function shouldRetryProxyResponse(request: Request, response: Response): boolean {
  return shouldRetryProxyRequest(request) && proxyRetryStatusCodes.includes(response.status)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
