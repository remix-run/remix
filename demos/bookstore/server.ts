import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { createBookstoreRouter } from './app/router.ts'
import { initializeBookstoreDatabase } from './app/data/setup.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

await initializeBookstoreDatabase()

const router = createBookstoreRouter()

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
const originPort = process.env.ORIGIN_PORT ? parseInt(process.env.ORIGIN_PORT, 10) : null

server.listen(port, () => {
  if (isDevelopment) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }

  console.log(`Bookstore is running on http://localhost:${originPort ?? port}`)
  console.log('')
  console.log('Demo accounts:')
  console.log('  Admin:    admin@bookstore.com / admin123')
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
