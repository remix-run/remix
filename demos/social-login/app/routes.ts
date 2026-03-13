import { form, get, post, route } from 'remix/fetch-router/routes'

export let routes = route({
  home: get('/'),
  auth: {
    login: form('login'),
    google: {
      login: get('/auth/google/login'),
      callback: get('/auth/google/callback'),
    },
    github: {
      login: get('/auth/github/login'),
      callback: get('/auth/github/callback'),
    },
    x: {
      login: get('/auth/x/login'),
      callback: get('/auth/x/callback'),
    },
    logout: post('/logout'),
  },
})
