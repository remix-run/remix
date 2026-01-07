import { createRoutes, form, resources } from '@remix-run/fetch-router'

export let routes = createRoutes({
  home: '/',
  login: form('/login'),
  logout: { method: 'POST', pattern: '/logout' },
  posts: resources('posts', { only: ['new', 'create', 'show'] }),
})
