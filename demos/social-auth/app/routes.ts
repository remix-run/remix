import { form, get, post, route } from 'remix/routes'

export const authBase = '/auth'

const authRouteDefs = {
  login: post('/login'),
  logout: post('/logout'),
  signup: form('/signup'),
  forgotPassword: form('/forgot-password'),
  resetPassword: form('/reset-password/:token'),
  google: route('/google', {
    login: get('/login'),
    callback: get('/callback'),
  }),
  github: route('/github', {
    login: get('/login'),
    callback: get('/callback'),
  }),
  x: route('/x', {
    login: get('/login'),
    callback: get('/callback'),
  }),
}

export const authRoutes = route(authRouteDefs)

export const routes = route({
  home: get('/'),
  account: get('/account'),
  auth: route(authBase, authRouteDefs),
})
