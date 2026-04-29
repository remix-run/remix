import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

const PORT = process.env.PORT || 3000

let server = http.createServer(
  createRequestListener(async (request) => {
    console.log(`method: ${request.method}`)

    for (let [key, value] of request.headers) {
      console.log(`${key}: ${value}`)
    }

    console.log(`body: ${await request.text()}`)

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
