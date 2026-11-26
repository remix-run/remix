import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

const PORT = process.env.PORT || 3000

const html = new TextEncoder().encode('<html><body><h1>Hello, world!</h1></body></html>')

let server = http.createServer(
  createRequestListener((_request) => {
    let stream = new ReadableStream({
      start(controller) {
        controller.enqueue(html)
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html' },
    })
  }),
)

server.listen(PORT)
