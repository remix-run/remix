import { route } from 'remix/fetch-router/routes'

export const routes = route({
  assets: '/(:version/)assets/*asset',
  docs: '/(:version/)api/*slug/',
  home: '/(:version/)',
  lookup: '/(:version/)api.json',
  markdown: '/(:version/)api/*slug.md',
})
