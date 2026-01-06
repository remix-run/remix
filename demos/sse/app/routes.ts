import { get, route } from 'remix'

export let routes = route({
  assets: '/assets/*path',
  home: get('/'),
  messages: get('/messages'),
})
