import { get, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: get(`${assetsBase}/*path`),
  home: get('/'),
  docs: route('docs', {
    index: get('/'),
    packageMap: get('package-map'),
    examples: route('examples', {
      show: get(':chapter/:example'),
    }),
    chapter: get(':chapter'),
  }),
})
