// server.js - Simple HTTP server to test server-side component HMR
import http from 'node:http'
import { Greeting } from './component.js'

console.log('Starting server...')

const server = http.createServer((req, res) => {
  console.log(`\n${req.method} ${req.url}`)

  // Create a minimal handle with an AbortController for cleanup
  let controller = new AbortController()
  let handle = {
    data: null,
    error: null,
    signal: controller.signal,
  }
  let render = Greeting(handle)
  let html = render({})

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(`<!DOCTYPE html>
<html>
<head><title>Server-side HMR Test</title></head>
<body>
  <h1>${html}</h1>
  <p><em>Edit component.js to see HMR updates without restart!</em></p>
</body>
</html>`)
  console.log(`Rendered: ${html}`)
})

server.listen(44100, () => {
  console.log('\n🚀 Server running on http://localhost:44100')
  console.log('📝 Edit component.js to see HMR')
  console.log('📝 Edit server.js to see full restart\n')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  server.close(() => process.exit(0))
})
