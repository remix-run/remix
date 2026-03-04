import { route } from '@remix-run/fetch-router/routes'

export let routes = route({
  home: '/',
  images: '/images/*path',
  scripts: '/scripts/*path',
})
