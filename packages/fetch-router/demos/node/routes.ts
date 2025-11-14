import { formAction, resource, resources, route } from '@remix-run/fetch-router'

export let routes = route({
  home: '/',
  login: formAction('/login'),
  logout: { method: 'POST', pattern: '/logout' },
  posts: {
    ...resources('posts', { only: ['index', 'new', 'create'] }),
    ...resource('/posts/:year-:month-:day/:slug', {
      only: ['show', 'edit', 'update', 'destroy'],
    }),
    comment: resources('/posts/:year-:month-:day/:slug/comment', {
      only: ['create', 'destroy'],
      param: 'commentId',
    }),
  },
})
