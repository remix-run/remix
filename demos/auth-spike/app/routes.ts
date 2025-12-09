import { route, formAction } from '@remix-run/fetch-router'

export let routes = route({
  home: '/',
  auth: {
    signUp: formAction('signup'),
    login: formAction('login'),
    forgotPassword: formAction('forgot-password'),
    resetPassword: formAction('reset-password/:token'),
  },
  account: route('/account', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
    logout: { method: 'POST', pattern: '/logout' },
    addPassword: formAction('add-password'),
    changePassword: formAction('change-password'),
  }),
  posts: {
    like: { method: 'POST', pattern: '/posts/:id/like' },
  },
  mockOAuth: route('/mock-oauth', {
    authorize: route('/authorize', {
      index: { method: 'GET', pattern: '/' },
      action: { method: 'POST', pattern: '/' },
    }),
    token: { method: 'POST', pattern: '/token' },
    user: { method: 'GET', pattern: '/user' },
  }),
})
