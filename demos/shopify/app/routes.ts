import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  agenticStorefronts: get('/agentic-storefronts'),
  pricing: get('/pricing'),
  sitemap: get('/sitemap'),
  marketing: get('/*path'),
})
