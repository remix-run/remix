import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { db } from './app/data/db.ts'
import { setupDatabase } from './app/data/setup.ts'
import { createAppRouter } from './app/router.ts'
import { assets } from './app/utils/assets.ts'
import { withSimulatedLatency } from './app/utils/simulated-latency.ts'

await setupDatabase(db)

const router = createAppRouter()
const server = http.createServer(createRequestListener(withSimulatedLatency(router.fetch)))
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`McMaster demo is running on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => {
    void assets.close().finally(() => process.exit(0))
  })
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
