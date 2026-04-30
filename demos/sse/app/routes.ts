import { get, route } from 'remix/routes'

export const routes = route({
  assets: '/assets/*path',
  home: get('/'),
  messages: get('/messages'),
})
