import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'

const server = http.createServer(createRequestListener(router.fetch))
const port = Number(process.env.PORT ?? 44100)

server.listen(port, () => {
  console.log(`Shopify demo is running on http://localhost:${port}`)
})

function shutdown() {
  server.close()
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
