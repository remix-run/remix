import { createRouter } from '@remix-run/fetch-router'

import { routes } from './routes.ts'

export let router = createRouter({ middleware: [] })

router.get(routes.home, () => new Response('Hello World'))
