import * as http from 'node:http'

import { createRequestListener } from 'remix/node-fetch-server'

import { createSocialLoginRouter } from './app/router.ts'

let router = createSocialLoginRouter()

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

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`Social login demo is running on http://localhost:${port}`)
  console.log('')
  console.log('Configure these environment variables to enable all providers:')
  console.log('  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  console.log('  GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET')
  console.log('  FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET')
  console.log('')
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
