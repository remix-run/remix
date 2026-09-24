import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

import { router } from './app/router.ts'

const PORT = 44100

const server = http.createServer(createRequestListener(router.fetch))

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
