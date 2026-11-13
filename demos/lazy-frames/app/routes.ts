import { get, post, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: get(`${assetsBase}/*path`),
  home: get('/'),
  latency: post('/demo-latency'),
  frames: route('frames', {
    html: get('html/:id'),
    ui: get('ui/:id'),
    interactive: get('interactive/:id'),
  }),
})
