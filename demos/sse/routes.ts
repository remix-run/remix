import { route } from '@remix-run/fetch-router'

export let routes = route({
  assets: '/assets/*path',
  home: '/',
  messages: '/messages',
})
