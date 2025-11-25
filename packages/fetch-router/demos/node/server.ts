import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

import { router } from './app/router.ts'

const PORT = 44100

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

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
