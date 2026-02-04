import { get, route } from 'remix/fetch-router'

export let routes = route({
  home: get('/'),
  time: get('/time'),
  frames: route('frames', {
    sidebar: get('/sidebar'),
    activity: get('/activity'),
    time: get('/time'),
  }),
})
