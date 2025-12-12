import { route, form } from '@remix-run/fetch-router'

export let routes = route({
  home: '/',
  auth: {
    signUp: form('signup'),
    login: form('login'),
    forgotPassword: form('forgot-password'),
    resetPassword: form('reset-password/:token'),
  },
  account: route('/account', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
    logout: { method: 'POST', pattern: '/logout' },
    addPassword: form('add-password'),
    changePassword: form('change-password'),
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
