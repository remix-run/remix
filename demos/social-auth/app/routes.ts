import { form, get, post, route } from 'remix/routes'

export const assetsBase = '/assets'

export const routes = route({
  assets: get(`${assetsBase}/*path`),
  home: get('/'),
  account: get('/account'),
  passkeys: route('/account/passkeys', {
    registrationOptions: post('/registration-options'),
    create: post('/'),
    rename: post('/:passkeyId/rename'),
    remove: post('/:passkeyId/remove'),
  }),
  auth: {
    login: post('/auth/login'),
    logout: post('/auth/logout'),
    signup: form('/auth/signup'),
    forgotPassword: form('/auth/forgot-password'),
    resetPassword: form('/auth/reset-password/:token'),
    passkey: route('/auth/passkey', {
      options: post('/options'),
      login: post('/login'),
    }),
    google: route('/auth/google', {
      login: get('/login'),
      callback: get('/callback'),
    }),
    github: route('/auth/github', {
      login: get('/login'),
      callback: get('/callback'),
    }),
    x: route('/auth/x', {
      login: get('/login'),
      callback: get('/callback'),
    }),
  },
})
