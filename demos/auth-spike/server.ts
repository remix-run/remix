import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { router } from './app/router.ts'

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
)

let port = 44100

server.listen(port, () => {
  console.log('🚀 Auth spike running at http://localhost:44100')
  console.log('')
  console.log('Try liking posts - you\'ll need to log in first!')
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log('\n👋 Shutting down...')
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
