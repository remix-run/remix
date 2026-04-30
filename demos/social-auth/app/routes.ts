import { form, get, post, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  account: get('/account'),
  auth: {
    login: post('/auth/login'),
    logout: post('/auth/logout'),
    signup: form('/auth/signup'),
    forgotPassword: form('/auth/forgot-password'),
    resetPassword: form('/auth/reset-password/:token'),
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
