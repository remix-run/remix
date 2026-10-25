import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { assetServer } from './app/actions/assets/controller.ts'
import { router } from './app/router.ts'

const server = http.createServer(createRequestListener(router.fetch))

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`Timeboxer demo is running on http://localhost:${port}`)
})

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  await assetServer.close()
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', () => {
  void shutdown()
})
process.on('SIGTERM', () => {
  void shutdown()
})
