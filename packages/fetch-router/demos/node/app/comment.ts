import type { RouteHandlers, Middleware } from '@remix-run/fetch-router'
import * as res from '@remix-run/fetch-router/response-helpers'

import { routes } from '../routes.ts'

import * as data from '../data.ts'

function requireAuth(): Middleware {
  return async ({ session }, next) => {
    let username = session.get('username')
    if (!username) {
      return res.redirect(routes.login.index.href())
    }
    return next()
  }
}

function requireCommentAuthor(): Middleware<any, { id: string; commentId: string }> {
  return async ({ session, params }, next) => {
    let username = session.get('username')
    let commentId = params.commentId
    let comment = data.getComment(commentId)

    if (!comment) {
      return new Response('Comment not found', { status: 404 })
    }

    if (comment.author !== username) {
      return new Response('Forbidden', { status: 403 })
    }

    return next()
  }
}

export let comment = {
  middleware: [requireAuth()],
  handlers: {
    async create({ params, formData, session }) {
      let post = data.getPost(params.id)
      if (!post) {
        return new Response('Post not found', { status: 404 })
      }

      if (!formData) {
        return new Response('Bad Request', { status: 400 })
      }

      let content = formData.get('content') as string
      if (!content) {
        return res.redirect(routes.posts.show.href({ id: params.id }))
      }

      let username = session.get('username') as string
      data.addComment(params.id, username, content)
      return res.redirect(routes.posts.show.href({ id: params.id }))
    },
    destroy: {
      middleware: [requireCommentAuthor()],
      async handler({ params }) {
        let comment = data.getComment(params.commentId)
        if (!comment) {
          return new Response('Comment not found', { status: 404 })
        }

        data.deleteComment(params.commentId)
        return res.redirect(routes.posts.show.href({ id: params.id }))
      },
    },
  },
} satisfies RouteHandlers<typeof routes.posts.comment>
