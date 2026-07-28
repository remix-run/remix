import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'
import { assetServer } from './app/utils/assets.ts'
import { createDevRefreshEvents } from './app/utils/dev-refresh-server.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const devRefreshEvents =
  process.env.NODE_ENV === 'production' ? undefined : createDevRefreshEvents()

const remixRequestListener = createRequestListener(async (request) => {
  try {
    return await router.fetch(request)
  } catch (error) {
    if (!(request.signal.aborted && error === request.signal.reason)) {
      console.error(error)
    }
    return new Response('Internal Server Error', { status: 500 })
  }
})

const server = http.createServer((request, response) => {
  if (devRefreshEvents?.handle(request, response)) {
    return
  }

  remixRequestListener(request, response)
})

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  devRefreshEvents?.close()

  try {
    await assetServer.close()
  } catch (error) {
    console.error(error)
  }

  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
