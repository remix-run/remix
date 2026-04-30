import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  packageBrowser: get('/*path'),
})
