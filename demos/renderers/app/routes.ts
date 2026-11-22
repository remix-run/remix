import { get, post, route } from 'remix/routes'

export const assetsBase = '/assets'

// Each renderer serves the same guestbook under its own prefix.
const guestbookRoutes = {
  guestbook: get('/'),
  sign: post('/entries'),
  entry: get('/entries/:id'),
}

export const routes = route({
  assets: `${assetsBase}/*path`,
  home: get('/'),
  preact: route('preact', guestbookRoutes),
  react: route('react', guestbookRoutes),
})
