import { get, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: `${assetsBase}/*path`,
  home: get('/'),
  messages: get('/messages'),
})
