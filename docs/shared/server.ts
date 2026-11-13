import * as fs from 'node:fs'
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import type { RequestContext, Router } from 'remix/router'

export interface DocsServerResource {
  close(): void | Promise<void>
}

export interface StartDocsServerOptions {
  assetServer: DocsServerResource
  /** Content read from disk. Changes restart the server during `pnpm run dev`. */
  content?: { dir: string; filter?: (file: string) => boolean }
  label: string
  port?: number
}

export function startDocsServer<context extends RequestContext<any, any>>(
  router: Router<context>,
  options: StartDocsServerOptions,
): http.Server {
  let { assetServer, content, label, port = readPort() } = options
  let isHmr = process.env.REMIX_NODE_HMR === '1'

  if (isHmr && content) watchContent(content.dir, content.filter)

  let server = http.createServer(createRequestListener(router.fetch, { trustProxy: isHmr }))

  // Under node-hmr, only the proxy is public.
  server.listen({ port, host: isHmr ? '127.0.0.1' : undefined }, () => {
    if (isHmr) {
      import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
    }
    console.log(`${label} running on http://localhost:${process.env.HMR_PROXY_PORT ?? port}`)
  })

  let shuttingDown = false

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true

    let serverClosed = new Promise<void>((resolve) => server.close(() => resolve()))
    server.closeAllConnections()

    await Promise.all([serverClosed, closeResource(assetServer)])
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())

  return server
}

// node-hmr only sees imported modules, so restart when content read with `fs` changes.
function watchContent(dir: string, filter?: (file: string) => boolean): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  fs.watch(dir, { recursive: true }, (_event, file) => {
    if (file === null || (filter && !filter(file))) return
    clearTimeout(timer)
    timer = setTimeout(() => import.meta.hot?.invalidate(`Content changed: ${file}`), 100)
  })
}

function readPort(): number {
  return process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
}

async function closeResource(resource: DocsServerResource): Promise<void> {
  try {
    await resource.close()
  } catch (error) {
    console.error(error)
  }
}
