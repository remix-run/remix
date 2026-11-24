import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { createHtmlResponse } from 'remix/response/html'

import { createBookstoreRouter } from './app/router.tsx'

const router = createBookstoreRouter()
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100
const hmrProxyPort = process.env.HMR_PROXY_PORT ? parseInt(process.env.HMR_PROXY_PORT, 10) : null
const isHmr = process.env.REMIX_NODE_HMR === '1'

const server = http.createServer(
  createRequestListener(router.fetch, {
    trustProxy: isHmr,
    // The router's errorPage() middleware renders most errors. This catches the rest, like errors
    // while rendering a page, without relying on the app that just failed.
    onError(error) {
      console.error(error)
      return createHtmlResponse(
        `<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Something Went Wrong | Bookstore</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem">
    <h1>📚 Bookstore</h1>
    <h2>Something Went Wrong</h2>
    <p>We hit an unexpected problem loading this page. Please try again in a moment.</p>
    <p><a href="/">Back Home</a></p>
  </body>
</html>`,
        { status: 500 },
      )
    },
  }),
)

server.listen(port, () => {
  if (isHmr) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }

  console.log(`Bookstore is running on http://localhost:${hmrProxyPort ?? port}`)
  console.log('')
  console.log('Demo accounts:')
  console.log('  Admin:    admin@bookstore.com / admin123')
  console.log('  Customer: customer@example.com / password123')
  console.log('')
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
