import { formAction, resources, route } from '@remix-run/fetch-router'

export let routes = route({
  home: '/',
  login: formAction('/login'),
  logout: { method: 'POST', pattern: '/logout' },
  // TODO: convert to RoutePattern :year-:month-:day/:slug
  posts: {
    ...resources('posts'),
    comments: resources('posts/:id/comments', {
      only: ['create', 'show', 'destroy'],
      param: 'commentId',
    }),
  },
})
