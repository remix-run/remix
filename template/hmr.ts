import * as http from 'node:http'
import * as process from 'node:process'

import { createFetchProxy } from 'remix/fetch-proxy'
import { createHmrReadyFetch, run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

// Force development mode here rather than with an inline `NODE_ENV=development` shell
// variable in package.json, which cmd.exe on Windows cannot parse. Assigning it keeps an
// inherited NODE_ENV (such as `production`) from overriding it in the app process below.
process.env.NODE_ENV = 'development'

const hmrProxyPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const hmrEventPort = process.env.HMR_PORT
  ? Number.parseInt(process.env.HMR_PORT, 10)
  : hmrProxyPort + 1
const appPort = process.env.APP_PORT ? Number.parseInt(process.env.APP_PORT, 10) : hmrEventPort + 1

const hmrRunner = run('server.ts', {
  env: {
    ...process.env,
    PORT: String(appPort),
    HMR_PROXY_PORT: String(hmrProxyPort),
  },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/component-hmr/node'],
  browserHmrChannel: { port: hmrEventPort },
})

const server = http.createServer(
  createRequestListener(
    createHmrReadyFetch(
      hmrRunner,
      createFetchProxy(`http://127.0.0.1:${appPort}`, {
        xForwardedHeaders: true,
      }),
    ),
  ),
)

server.listen(hmrProxyPort, '127.0.0.1')

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => hmrRunner.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
