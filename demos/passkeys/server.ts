import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { createPasskeysRouter } from './app/router.ts'
import { getDemoOrigin } from './app/utils/passkeys.ts'

const router = createPasskeysRouter()
const server = http.createServer(createRequestListener(router.fetch))
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`Passkeys demo is running on ${getDemoOrigin()}`)
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
