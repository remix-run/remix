import { route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/(:version)',
  api: '/(:version/)api/*slug',
  assets: '/(:version/)assets/*asset',
})
