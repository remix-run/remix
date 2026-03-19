import { readFile } from 'node:fs/promises'

import { createRouter } from 'remix/fetch-router'

import { routes } from './routes.ts'

let loginPage = readFile(new URL('./login.html', import.meta.url), 'utf8')

export let router = createRouter()

router.map(routes, {
  actions: {
    async home() {
      return new Response(await loginPage, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
    },
  },
})
