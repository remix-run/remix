import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { createRecordStoreRouter } from './app/router.ts'

const router = createRecordStoreRouter()
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100
const hmrProxyPort = process.env.HMR_PROXY_PORT ? parseInt(process.env.HMR_PROXY_PORT, 10) : null
const isHmr = process.env.REMIX_NODE_HMR === '1'

const server = http.createServer(createRequestListener(router.fetch, { trustProxy: isHmr }))

server.listen(port, () => {
  if (isHmr) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }

  console.log(`Record Store is running on http://localhost:${hmrProxyPort ?? port}`)
  console.log('')
  console.log('Demo accounts:')
  console.log('  Admin:    admin@recordstore.com / admin123')
  console.log('  Customer: customer@example.com / password123')
  console.log('')
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
