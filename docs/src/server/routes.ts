import { route } from 'remix/routes'

export const routes = route({
  assets: '/(:version/)assets/*asset',
  markdown: '/(:version/)api/*slug.md',
  docs: '/(:version/)api/*slug/',
  home: '/(:version/)',
  lookup: '/(:version/)api.json',
})
