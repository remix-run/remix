import { get, route } from '@remix-run/fetch-router/routes'

export let routes = route({
  home: get('/'),
  simpleHydration: get('/simple-hydration'),
  oooStreaming: get('/ooo-streaming'),
  nestedFrames: get('/nested-frames'),
  frameReload: get('/frame-reload'),
  frames: route('frames', {
    slowA: get('/slow-a'),
    slowB: get('/slow-b'),
    nestedOuter: get('/nested-outer'),
    nestedInner: get('/nested-inner'),
    reloadableClock: get('/reloadable-clock'),
  }),
})
