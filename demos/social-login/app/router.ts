import { createRouter } from 'remix/fetch-router'

import { home } from './home.tsx'
import { routes } from './routes.ts'

export let router = createRouter()

router.map(routes, {
  actions: {
    home,
  },
})
