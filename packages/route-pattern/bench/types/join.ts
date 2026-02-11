import { bench } from '@ark/attest'
import { RoutePattern, type Join } from '@remix-run/route-pattern'

bench.baseline(() => {
  let pattern = new RoutePattern('/')
  pattern.join('/other')
})

bench('join', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.join('/comments/:commentId')
}).types([2445, 'instantiations'])

bench('Join', () => {
  type _ = Join<'/posts/:id', '/comments/:commentId'>
}).types([2399, 'instantiations'])

bench('join > mediarss', () => {
  const other = '/comments/:commentId'
  type Route = keyof typeof import('../routes/mediarss.ts').routes
  let routes: { [route in Route]: RoutePattern<route> } = {} as any

  routes.feed.join(other)
  routes.media.join(other)
  routes.art.join(other)
  // OAuth routes (public)
  routes.oauthToken.join(other)
  routes.oauthJwks.join(other)
  routes.oauthRegister.join(other)
  routes.oauthServerMetadata.join(other)
  // MCP routes
  routes.mcp.join(other)
  routes.mcpProtectedResource.join(other)
  routes.mcpWidget.join(other)
  // Admin routes
  routes.adminHealth.join(other)
  routes.adminApiVersion.join(other)
  routes.adminAuthorize.join(other)
  routes.admin.join(other)
  routes.adminCatchAll.join(other)
  routes.adminApiFeeds.join(other)
  routes.adminApiDirectories.join(other)
  routes.adminApiBrowse.join(other)
  routes.adminApiCreateDirectoryFeed.join(other)
  routes.adminApiCreateCuratedFeed.join(other)
  routes.adminApiFeed.join(other)
  routes.adminApiFeedTokens.join(other)
  routes.adminApiFeedItems.join(other)
  routes.adminApiFeedArtwork.join(other)
  routes.adminApiToken.join(other)
  routes.adminApiMedia.join(other)
  routes.adminApiMediaAssignments.join(other)
  routes.adminApiMediaDetail.join(other)
  routes.adminApiMediaMetadata.join(other)
  routes.adminApiMediaStream.join(other)
  routes.adminApiMediaUpload.join(other)
  routes.adminApiArtwork.join(other)
}).types([44665, 'instantiations'])
