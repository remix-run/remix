import { get, post, route } from 'remix/routes'

export const assetsBase = '/assets'
export const assetsRoute = get(`${assetsBase}/*path`)

export const routes = route({
  home: get('/(:locale)'),
  language: post('/language'),
})
