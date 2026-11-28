import { get, post, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: `${assetsBase}/*path`,
  home: get('/'),
  board: get('/board'),
  log: get('/log'),
  drop: post('/drop'),
})
