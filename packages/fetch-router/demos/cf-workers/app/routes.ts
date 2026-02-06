import { route, form, resources } from '@remix-run/fetch-router/routes'

export let routes = route({
  home: '/',
  login: form('/login'),
  logout: { method: 'POST', pattern: '/logout' },
  posts: resources('posts', { only: ['new', 'create', 'show'] }),
})
