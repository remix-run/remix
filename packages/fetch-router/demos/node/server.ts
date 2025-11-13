import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

import { router } from './router.ts'

const PORT = 3000

// TODO:
// - Review code
// - Colocate code more
// - Use YYYY-MM-DD for dates in the url with RoutePattern
// - Add slightly better styling with stylesheet
// - Identify where we can use events (for later demo)

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
