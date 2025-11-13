import { formAction, resources, route } from '@remix-run/fetch-router'

export let routes = route({
  home: '/',
  login: formAction('/login'),
  logout: { method: 'POST', pattern: '/logout' },
  // TODO: convert to RoutePattern :year-:month-:day/:slug
  posts: {
    ...resources('posts'),
    comment: resources('posts/:id/comment', {
      only: ['create', 'destroy'],
      param: 'commentId',
    }),
  },
})
