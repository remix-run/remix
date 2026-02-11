import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'

bench.baseline(() => {
  new RoutePattern('/')
})

bench('new > simple route', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.source
}).types([3, 'instantiations'])

bench('new > complex route', () => {
  let pattern = new RoutePattern('/api(/v:major(.:minor))/*path/help')
  pattern.source
}).types([3, 'instantiations'])

bench('new > mediarss', () => {
  type Routes = typeof import('../routes/mediarss.ts').routes
  let routes: { [route in keyof Routes]: RoutePattern<Routes[route]> } = {} as any

  routes.feed
  routes.media
  routes.art
  // OAuth routes (public)
  routes.oauthToken
  routes.oauthJwks
  routes.oauthRegister
  routes.oauthServerMetadata
  // MCP routes
  routes.mcp
  routes.mcpProtectedResource
  routes.mcpWidget
  // Admin routes
  routes.adminHealth
  routes.adminApiVersion
  routes.adminAuthorize
  routes.admin
  routes.adminCatchAll
  routes.adminApiFeeds
  routes.adminApiDirectories
  routes.adminApiBrowse
  routes.adminApiCreateDirectoryFeed
  routes.adminApiCreateCuratedFeed
  routes.adminApiFeed
  routes.adminApiFeedTokens
  routes.adminApiFeedItems
  routes.adminApiFeedArtwork
  routes.adminApiToken
  routes.adminApiMedia
  routes.adminApiMediaAssignments
  routes.adminApiMediaDetail
  routes.adminApiMediaMetadata
  routes.adminApiMediaStream
  routes.adminApiMediaUpload
  routes.adminApiArtwork
}).types([128, 'instantiations'])
