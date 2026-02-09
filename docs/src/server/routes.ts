import { route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  api: '/api/*path',
})
