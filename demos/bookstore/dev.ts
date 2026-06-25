import * as http from 'node:http'

import { createHmrReadyFetch, run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

import { createFetchProxy } from './fetch-proxy.ts'

const originPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100
const childPort = process.env.CHILD_PORT ? parseInt(process.env.CHILD_PORT, 10) : originPort + 1
const hmrPort = process.env.HMR_PORT ? parseInt(process.env.HMR_PORT, 10) : childPort + 1

const hmrRunner = run('server.ts', {
  env: {
    ...process.env,
    ORIGIN_PORT: String(originPort),
    PORT: String(childPort),
  },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  browserHmrChannel: { port: hmrPort },
})

const server = http.createServer(
  createRequestListener(
    createHmrReadyFetch(
      hmrRunner,
      createFetchProxy(`http://127.0.0.1:${childPort}`, {
        xForwardedHeaders: true,
      }),
    ),
  ),
)

server.listen(originPort, '127.0.0.1')

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => hmrRunner.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
