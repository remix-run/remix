import { get, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: get('/'),
  scripts: get('/assets/*path'),
})
