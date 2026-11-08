import * as http from 'node:http'
import * as net from 'node:net'

import { createFetchProxy } from 'remix/fetch-proxy'
import { createHmrReadyFetch, run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

// Runs the current site's `server.ts` under node-hmr behind a stable proxy on `PORT`.
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const appPort = await findAvailablePort()

const hmrRunner = run('server.ts', {
  env: { ...process.env, HMR_PROXY_PORT: String(port), PORT: String(appPort) },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/component-hmr/node'],
})

http
  .createServer(
    createRequestListener(
      createHmrReadyFetch(
        hmrRunner,
        createFetchProxy(`http://127.0.0.1:${appPort}`, { xForwardedHeaders: true }),
      ),
    ),
  )
  .listen(port)

function shutdown() {
  void hmrRunner.close().then(() => process.exit(0))
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      let { port } = server.address() as net.AddressInfo
      server.close(() => resolve(port))
    })
  })
}
