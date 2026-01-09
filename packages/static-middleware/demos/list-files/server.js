import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter } from '@remix-run/fetch-router'
import { staticFiles } from '@remix-run/static-middleware'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 44100

// Point to the monorepo root (two levels up from demos/list-files)
let root = path.resolve(__dirname, '..', '..', '..', '..')

let router = createRouter({
  middleware: [
    staticFiles(root, {
      listFiles: true,
      // Disable index file serving so directories always show the file listing
      index: false,
    }),
  ],
})

let server = http.createServer(createRequestListener((request) => router.fetch(request)))

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`Serving files from: ${root}`)
})
