import { formAction, route, resources } from '@remix-run/fetch-router'

export let routes = route({
  home: '/',
  login: formAction('/login'),
  logout: { method: 'POST', pattern: '/logout' },
  posts: resources('posts', { only: ['new', 'create', 'show'] }),
})

