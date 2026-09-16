import { get, route } from 'remix/routes'

export const assetsBase = '/assets'
export const workerAssetsBase = '/worker-assets'

export const routes = route({
  home: get('/'),
  assets: get(`${assetsBase}/*path`),
  workerAssets: get(`${workerAssetsBase}/*path`),
})
