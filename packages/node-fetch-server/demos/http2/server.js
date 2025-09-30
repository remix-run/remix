import * as http2 from 'node:http2'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequestListener } from '@remix-run/node-fetch-server'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const PORT = 3000

let options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.crt')),
}

let server = http2.createSecureServer(options)

server.on(
  'request',
  createRequestListener((request) => {
    let url = new URL(request.url)

    if (url.pathname === '/') {
      return new Response('Hello HTTP/2!', {
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    return new Response('Not Found', { status: 404 })
  }),
)

server.on('error', (err) => {
  console.error('Server error:', err)
})

server.listen(PORT, () => {
  console.log(`Server running at https://localhost:${PORT}`)
})
