import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

const PORT = process.env.PORT || 3000
const encoder = new TextEncoder()

let server = http.createServer(
  createRequestListener(async (request) => {
    let headerBytes = 0
    for (let [key, value] of request.headers) {
      headerBytes += key.length + value.length
    }

    let body = await request.text()
    let html = encoder.encode(
      `<html><body><h1>${request.method} ${headerBytes} ${body.length}</h1></body></html>`,
    )

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
