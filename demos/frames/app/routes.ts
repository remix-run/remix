import { get, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: `${assetsBase}/*path`,
  home: get('/'),
  time: get('/time'),
  reloadScope: get('/reload-scope'),
  rootReloadClientEntries: get('/root-reload-client-entries'),
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
    stateSearchResults: get('/state-search-results'),
  }),
})
