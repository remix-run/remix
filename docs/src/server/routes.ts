import { route } from 'remix/fetch-router/routes'

export const routes = route({
  assets: '/(:version/)assets/*asset',
  docs: '/(:version/)api/*slug',
  home: '/(:version/)',
  // Trailing slash is needed for proper HTML file responses on github pages
  fragment: '/(:version/)fragment/(*slug/)',
  markdown: '/(:version/)api/*slug.md',
})
