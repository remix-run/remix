import { get, route } from 'remix/fetch-router/routes'

export let routes = route({
  home: get('/'),
  time: get('/time'),
  reloadScope: get('/reload-scope'),
  stateSearch: get('/state-search'),
  clientMounted: get('/client-mounted'),
  frames: route('frames', {
    clientFrameExample: get('/client-frame-example'),
    clientFrameExampleNested: get('/client-frame-example/nested'),
    clientMountedOuter: get('/client-mounted-outer'),
    clientMountedNested: get('/client-mounted-nested'),
    sidebar: get('/sidebar'),
    activity: get('/activity'),
    activityDetail: get('/activity/detail'),
    time: get('/time'),
    reloadScope: get('/reload-scope'),
    stateSearchResults: get('/state-search-results'),
  }),
})
