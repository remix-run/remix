import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { createRouter } from '@remix-run/fetch-router'

import { routes } from './routes.ts'

import { homeHandler, aboutHandler, contactHandlers, pricingHandler } from './app/marketing.ts'

import { booksHandlers } from './app/books.ts'
import { storeHandlers } from './app/store.ts'
import { authHandlers } from './app/auth.ts'
import { adminHandlers } from './app/admin.ts'

import { blogHandlers } from './app/blog.ts'
import { usersHandlers } from './app/users.ts'
import { apiBooksHandlers } from './app/api-books.ts'
import { apiOrdersHandlers } from './app/api-orders.ts'

import { searchHandler } from './app/search.ts'

import { globalMiddleware } from './app/middleware/index.ts'

let router = createRouter(globalMiddleware)

router.addRoutes(routes, {
  home: homeHandler,
  about: aboutHandler,
  contact: contactHandlers,
  pricing: pricingHandler,

  books: booksHandlers,
  store: storeHandlers,
  auth: authHandlers,
  admin: adminHandlers,

  blog: blogHandlers,
  users: usersHandlers,

  api: {
    books: apiBooksHandlers,
    orders: apiOrdersHandlers,
    search: searchHandler,
  },
})

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

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
