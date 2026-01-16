import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'
import router from './router.tsx'

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

server.listen(port, () => {
  console.log(`Remix API docs server running on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
