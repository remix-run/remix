import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import type { RequestContext, Router } from 'remix/router'

export interface DocsServerResource {
  close(): void | Promise<void>
}

export interface DocsServerRequestHandler extends DocsServerResource {
  handle(request: http.IncomingMessage, response: http.ServerResponse): boolean
}

export interface StartDocsServerOptions {
  assetServer: DocsServerResource
  devRefresh?: DocsServerRequestHandler
  label: string
  port?: number
}

export function startDocsServer<context extends RequestContext<any, any>>(
  router: Router<context>,
  options: StartDocsServerOptions,
): http.Server {
  let { assetServer, devRefresh, label, port = readPort() } = options
  let requestListener = createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  })

  let server = http.createServer((request, response) => {
    if (!devRefresh?.handle(request, response)) {
      requestListener(request, response)
    }
  })

  server.listen(port, () => {
    console.log(`${label} running on http://localhost:${port}`)
  })

  let shuttingDown = false

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true

    await closeResource(devRefresh)

    let serverClosed = new Promise<void>((resolve) => server.close(() => resolve()))
    server.closeAllConnections()

    await Promise.all([serverClosed, closeResource(assetServer)])
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())

  return server
}

function readPort(): number {
  return process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
}

async function closeResource(resource: DocsServerResource | undefined): Promise<void> {
  try {
    await resource?.close()
  } catch (error) {
    console.error(error)
  }
}
