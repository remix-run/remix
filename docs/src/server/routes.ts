import { route } from 'remix/fetch-router/routes'

export const routes = route({
  assets: '/(:version/)assets/*asset',
  docs: '/(:version/)api/*slug',
  home: '/(:version/)',
  fragment: '/(:version/)fragment/(*slug)',
  md: '/(:version/)api/*slug.md',
})
