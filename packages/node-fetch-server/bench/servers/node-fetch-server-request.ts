import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

const PORT = process.env.PORT || 3000

let server = http.createServer(
  createRequestListener((request) => {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let stream = new ReadableStream({
      start(controller) {
        controller.enqueue('<html><body><h1>Hello, world!</h1></body></html>')
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html' },
    })
  }),
)

server.listen(PORT)
