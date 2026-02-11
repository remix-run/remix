import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'

bench.baseline(() => {
  let pattern = new RoutePattern('/')
  pattern.href()
})

bench('href > simple route', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.href({ id: '123' })
}).types([1171, 'instantiations'])

bench('href > complex route', () => {
  let pattern = new RoutePattern('/api(/v:major(.:minor))/*path/help')
  pattern.href({ major: '1', minor: '2', path: 'users', help: 'help' })
}).types([4575, 'instantiations'])

bench('href > mediarss', () => {
  type Route = keyof typeof import('../routes/mediarss.ts').routes
  let routes: { [route in Route]: RoutePattern<route> } = {} as any

  routes.feed.href({ token: '123' })
  routes.media.href({ token: '123', path: 'users' })
  routes.art.href({ token: '123', path: 'users' })
  // OAuth routes (public)
  routes.oauthToken.href()
  routes.oauthJwks.href()
  routes.oauthRegister.href()
  routes.oauthServerMetadata.href()
  // MCP routes
  routes.mcp.href()
  routes.mcpProtectedResource.href()
  routes.mcpWidget.href({ token: '123', path: 'users' })
  // Admin routes
  routes.adminHealth.href()
  routes.adminApiVersion.href()
  routes.adminAuthorize.href()
  routes.admin.href()
  routes.adminCatchAll.href({ path: 'users' })
  routes.adminApiFeeds.href()
  routes.adminApiDirectories.href()
  routes.adminApiBrowse.href()
  routes.adminApiCreateDirectoryFeed.href()
  routes.adminApiCreateCuratedFeed.href()
  routes.adminApiFeed.href({ id: '123' })
  routes.adminApiFeedTokens.href({ id: '123' })
  routes.adminApiFeedItems.href({ id: '123' })
  routes.adminApiFeedArtwork.href({ id: '123' })
  routes.adminApiToken.href({ token: '123' })
  routes.adminApiMedia.href()
  routes.adminApiMediaAssignments.href()
  routes.adminApiMediaDetail.href({ path: 'users' })
  routes.adminApiMediaMetadata.href({ path: 'users' })
  routes.adminApiMediaStream.href({ path: 'users' })
  routes.adminApiMediaUpload.href()
  routes.adminApiArtwork.href({ path: 'users' })
}).types([39583, 'instantiations'])
