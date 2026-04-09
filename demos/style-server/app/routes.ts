import { get, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: get('/'),
  styles: get('/styles/*path'),
})
