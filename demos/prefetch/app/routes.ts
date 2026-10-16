import { get } from 'remix/routes'

export const routes = {
  assets: get('/assets/*path'),
  home: get('/'),
  product: get('/products/:slug'),
}
