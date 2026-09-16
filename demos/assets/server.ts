import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'
import { assets, workerAssets } from './app/utils/assets.ts'

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`assets demo is running on http://localhost:${port}`)
  console.log('Edit a document or worker module and refresh to verify that assets update.')
})

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  await Promise.all([assets.close(), workerAssets.close()])
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', () => {
  void shutdown()
})
process.on('SIGTERM', () => {
  void shutdown()
})
