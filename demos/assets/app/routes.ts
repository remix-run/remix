import { get, route } from 'remix/fetch-router/routes'

export const assetsBase = '/assets'

export const routes = route({
  home: get('/'),
  assets: get(`${assetsBase}/*path`),
})
