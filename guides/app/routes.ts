import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  devRefresh: get('/__dev/refresh'),
  home: get('/'),
  docs: route('docs', {
    index: get('/'),
    examples: route('examples', {
      show: get(':chapter/:example'),
    }),
    chapter: get(':chapter'),
  }),
})
