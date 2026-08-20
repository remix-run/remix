import { get, post, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: `${assetsBase}/*path`,
  home: get('/'),
  time: get('/time'),
  reloadScope: get('/reload-scope'),
  rootReloadClientEntries: get('/root-reload-client-entries'),
  scrollRestoration: get('/scroll-restoration'),
  scrollRestorationDetail: get('/scroll-restoration/detail'),
  newsletterSignup: post('/scroll-restoration/newsletter'),
  stateSearch: get('/state-search'),
  clientMounted: get('/client-mounted'),
  frames: route('frames', {
    clientFrameExample: get('/client-frame-example'),
    clientFrameExampleNested: get('/client-frame-example/nested'),
    clientMountedOuter: get('/client-mounted-outer'),
    clientMountedNested: get('/client-mounted-nested'),
    rootReloadEntryFrame: get('/root-reload-entry-frame'),
    sidebar: get('/sidebar'),
    activity: get('/activity'),
    activityDetail: get('/activity/detail'),
    time: get('/time'),
    reloadScope: get('/reload-scope'),
    reloadScopeBlocking: get('/reload-scope/blocking'),
    scrollRestorationItems: get('/scroll-restoration-items'),
    stateSearchResults: get('/state-search-results'),
  }),
})
