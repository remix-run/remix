import { get, route } from 'remix/fetch-router'

export let routes = route({
  assets: '/assets/*path',
  home: get('/'),
  messages: get('/messages'),
})
