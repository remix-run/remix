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
    facebook: {
      login: get('/auth/facebook/login'),
      callback: get('/auth/facebook/callback'),
    },
    logout: post('/logout'),
  },
})
