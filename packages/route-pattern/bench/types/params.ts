import { bench } from '@ark/attest'
import { RoutePattern, type Params } from '@remix-run/route-pattern'

bench.baseline(() => {
  let pattern = new RoutePattern('/:var/*wild')
  let match = pattern.match('')!
  match.params
})

bench('params > simple route', () => {
  let pattern = new RoutePattern('/posts/:id')
  let match = pattern.match('https://example.com/posts/123')
  match?.params.id
}).types([762, 'instantiations'])

bench('params > complex route', () => {
  let pattern = new RoutePattern('/api(/v:major(.:minor))/*path/help')
  pattern.match('https://example.com/api/v1/users/123')?.params
}).types([3804, 'instantiations'])

bench('params > mediarss', () => {
  type Routes = typeof import('../routes/mediarss.ts').routes
  let routes: { [route in keyof Routes]: RoutePattern<Routes[route]> } = {} as any
  let url: URL = {} as any

  routes.feed.match(url)?.params
  routes.media.match(url)?.params
  routes.art.match(url)?.params
  // OAuth routes (public)
  routes.oauthToken.match(url)?.params
  routes.oauthJwks.match(url)?.params
  routes.oauthRegister.match(url)?.params
  routes.oauthServerMetadata.match(url)?.params
  // MCP routes
  routes.mcp.match(url)?.params
  routes.mcpProtectedResource.match(url)?.params
  routes.mcpWidget.match(url)?.params
  // Admin routes
  routes.adminHealth.match(url)?.params
  routes.adminApiVersion.match(url)?.params
  routes.adminAuthorize.match(url)?.params
  routes.admin.match(url)?.params
  routes.adminCatchAll.match(url)?.params
  routes.adminApiFeeds.match(url)?.params
  routes.adminApiDirectories.match(url)?.params
  routes.adminApiBrowse.match(url)?.params
  routes.adminApiCreateDirectoryFeed.match(url)?.params
  routes.adminApiCreateCuratedFeed.match(url)?.params
  routes.adminApiFeed.match(url)?.params
  routes.adminApiFeedTokens.match(url)?.params
  routes.adminApiFeedItems.match(url)?.params
  routes.adminApiFeedArtwork.match(url)?.params
  routes.adminApiToken.match(url)?.params
  routes.adminApiMedia.match(url)?.params
  routes.adminApiMediaAssignments.match(url)?.params
  routes.adminApiMediaDetail.match(url)?.params
  routes.adminApiMediaMetadata.match(url)?.params
  routes.adminApiMediaStream.match(url)?.params
  routes.adminApiMediaUpload.match(url)?.params
  routes.adminApiArtwork.match(url)?.params
}).types([74851, 'instantiations'])
