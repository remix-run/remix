import * as http from 'node:http'
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
    let server = http.createServer(createRequestListener((request) => handler(request)))

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
