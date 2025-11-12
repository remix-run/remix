import { route } from '@remix-run/fetch-router'

// The demo should have a few routes and use some basic middleware.

// TODO: show off the response helpers
// import { html, json, redirect } from '@remix-run/fetch-router/response-helpers'

// TODO: show off the middleware:
// async-context-middleware
// form-data-middleware
// logger-middleware
// method-override-middleware
// session-middleware

export let routes = route({
  home: '/',
})
