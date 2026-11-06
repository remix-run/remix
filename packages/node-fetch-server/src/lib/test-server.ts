import * as http from 'node:http'
import type { Socket } from 'node:net'

import { createRequestListener } from './request-listener.ts'

/**
 * Result returned by {@link createTestServer}.
 */
export interface TestServer {
  /**
   * The base URL the server is listening on, e.g. `http://127.0.0.1:54321`.
   */
  baseUrl: string

  /**
   * Stops the server and resolves once all in-flight connections have closed.
   */
  close(): Promise<void>
}

/**
 * Starts an `http.Server` on a random localhost port that delegates to the
 * given fetch-style handler. Intended for integration tests — pair the
 * returned {@link TestServer} with `t.serve()` from `@remix-run/test` to
 * drive it from a Playwright `Page`.
 *
 * @param handler - A fetch-style `(request) => Response | Promise<Response>`
 *   (e.g. `router.fetch` from `@remix-run/fetch-router`)
 * @returns A promise that resolves to the running {@link TestServer}.
 */
export function createTestServer(
  handler: (request: Request) => Response | Promise<Response>,
): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    let server = http.createServer(createRequestListener(handler))
    if (process.env.REMIX_TEST_DIAGNOSTICS === '1') instrumentServer(server)

    server.listen(0, '127.0.0.1', () => {
      let addr = server.address() as { port: number }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r, rj) => server.close((e) => (e ? rj(e) : r()))),
      })
    })

    server.on('error', reject)
  })
}

// Temporary transport diagnostics; keep native server.close() semantics unchanged.
function instrumentServer(server: http.Server): void {
  let sockets = new Set<Socket>()
  let requests = new Map<http.ServerResponse, string>()
  function log(message: string) {
    console.error(
      `[server-diagnostics ${new Date().toISOString()} pid=${process.pid}] ${message}; sockets=${sockets.size}; pending=${JSON.stringify([...requests.values()])}`,
    )
  }
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => {
      sockets.delete(socket)
      log('socket closed')
    })
  })
  server.on('request', (request, response) => {
    let label = `${request.method} ${request.url?.split('?')[0]}`
    requests.set(response, label)
    log(`request started: ${label}`)
    response.once('finish', () => {
      requests.delete(response)
      log(`response finished: ${label}`)
    })
    response.once('close', () => {
      requests.delete(response)
      log(`response closed: ${label}; finished=${response.writableFinished}`)
    })
  })
  let heartbeat = setInterval(() => log('server heartbeat'), 15_000)
  heartbeat.unref()
  server.once('close', () => {
    clearInterval(heartbeat)
    log('server closed')
  })
}
