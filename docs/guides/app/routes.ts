import { get, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: get(`${assetsBase}/*path`),
  docs: route('', {
    index: get('/'),
    examples: route('examples', {
      show: get(':chapter/:example(/)'),
    }),
    chapter: get(':chapter(/)'),
  }),
})
