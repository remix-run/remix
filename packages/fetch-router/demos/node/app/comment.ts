import type { Middleware, RouteHandlers } from '@remix-run/fetch-router'
import type { Params } from '@remix-run/route-pattern'
import * as res from '@remix-run/fetch-router/response-helpers'

import { routes } from '../routes.ts'
import * as data from '../data.ts'
import { getPostHrefParams } from './utils.ts'

function requireAuth(): Middleware {
  return async ({ session }, next) => {
    let username = session.get('username')
    if (!username) {
      return res.redirect(routes.login.index.href())
    }
    return next()
  }
}

function requireCommentAuthor(): Middleware<
  any,
  Params<typeof routes.posts.comment.destroy.pattern.source>
> {
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
      let post = data.getPost(params.slug)
      if (!post) {
        return new Response('Post not found', { status: 404 })
      }

      if (!formData) {
        return new Response('Bad Request', { status: 400 })
      }

      let content = formData.get('content') as string
      if (!content) {
        return res.redirect(routes.posts.show.href(getPostHrefParams(post)))
      }

      let username = session.get('username') as string
      data.addComment(params.slug, username, content)
      return res.redirect(routes.posts.show.href(getPostHrefParams(post)))
    },
    destroy: {
      middleware: [requireCommentAuthor()],
      async handler({ params }) {
        let comment = data.getComment(params.commentId)
        if (!comment) {
          return new Response('Comment not found', { status: 404 })
        }

        let post = data.getPost(comment.postSlug)
        if (!post) {
          return new Response('Post not found', { status: 404 })
        }

        data.deleteComment(params.commentId)
        return res.redirect(routes.posts.show.href(getPostHrefParams(post)))
      },
    },
  },
} satisfies RouteHandlers<typeof routes.posts.comment>
