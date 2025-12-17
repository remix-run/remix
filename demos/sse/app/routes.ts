import { get, route } from '@remix-run/fetch-router'

export let routes = route({
  assets: '/assets/*path',
  home: get('/'),
  messages: get('/messages'),
})
