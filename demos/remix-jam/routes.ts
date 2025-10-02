import { createRoutes } from '@remix-run/fetch-router'

export let routes = createRoutes({
  home: '/',
  about: '/about',
})
