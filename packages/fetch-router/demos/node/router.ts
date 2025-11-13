import { createRouter } from '@remix-run/fetch-router'
import type { Middleware } from '@remix-run/fetch-router'
import { formData } from '@remix-run/fetch-router/form-data-middleware'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'
import { session } from '@remix-run/fetch-router/session-middleware'
import * as res from '@remix-run/fetch-router/response-helpers'
import { createCookie } from '@remix-run/cookie'

import { routes } from './routes.ts'
import * as data from './data.ts'
import * as templates from './templates.ts'

// TODO: group stuff better and potentially split out handlers into separate files

// Simple auth middleware - checks if user is logged in
function requireAuth(): Middleware {
  return async (context, next) => {
    let username = context.session.get('username')
    if (!username) {
      return res.redirect(routes.login.index.href())
    }
    return next()
  }
}

// Middleware to redirect authenticated users away from login page
function requireGuest(): Middleware {
  return async (context, next) => {
    let username = context.session.get('username')
    if (username) {
      return res.redirect(routes.posts.index.href())
    }
    return next()
  }
}

// Create a signed cookie for session
let sessionCookie = createCookie('blog_session', {
  secrets: ['demo-secret-key-change-in-production'],
})

export let router = createRouter({
  middleware: [logger(), formData(), methodOverride(), session(sessionCookie)],
})

// Home page
router.get(routes.home, ({ session }) => {
  let posts = data.getPosts()
  let currentUser = session.get('username') as string | undefined

  return res.html(templates.layout(templates.homePage(posts), currentUser))
})

// Login routes - redirect if already authenticated
router.map(routes.login, {
  index: {
    middleware: [requireGuest()],
    handler({ session }) {
      let currentUser = session.get('username') as string | undefined
      return res.html(templates.layout(templates.loginForm(), currentUser))
    },
  },
  action: {
    middleware: [requireGuest()],
    async handler({ formData, session }) {
      let username = formData.get('username') as string
      let password = formData.get('password') as string

      // Simple auth - in real app, check against database
      if (username && password) {
        session.set('username', username)
        session.flash('success', 'Logged in successfully!')
        return res.redirect(routes.posts.index.href())
      }

      let currentUser = session.get('username') as string | undefined
      return res.html(templates.layout(templates.loginForm('Invalid credentials'), currentUser))
    },
  },
})

// Logout route
router.post(routes.logout, ({ session }) => {
  session.destroy()
  return res.redirect(routes.home.href())
})

// Posts routes
router.map(routes.posts, {
  index({ session }) {
    let posts = data.getPosts()
    let currentUser = session.get('username') as string | undefined
    return res.html(templates.layout(templates.postList(posts), currentUser))
  },
  new({ session }) {
    let currentUser = session.get('username') as string | undefined
    return res.html(templates.layout(templates.postForm(), currentUser))
  },
  async create({ formData }) {
    console.log('create', formData)
    let title = formData.get('title') as string
    let content = formData.get('content') as string

    if (!title || !content) {
      return res.html(templates.layout(templates.postForm()), { status: 400 })
    }

    let post = data.createPost(title, content)
    return res.redirect(routes.posts.show.href({ id: post.id }))
  },
  show({ params, session }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    let comments = data.getComments(params.id)
    let currentUser = session.get('username') as string | undefined
    return res.html(
      templates.layout(templates.postDetail(post, comments, currentUser), currentUser),
    )
  },
  edit({ params, session }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    let currentUser = session.get('username') as string | undefined
    return res.html(templates.layout(templates.postForm(post), currentUser))
  },
  async update({ params, formData }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    let title = formData.get('title') as string
    let content = formData.get('content') as string

    if (!title || !content) {
      return res.html(templates.layout(templates.postForm(post)), { status: 400 })
    }

    data.updatePost(params.id, title, content)
    return res.redirect(routes.posts.show.href({ id: params.id }))
  },
  async destroy({ params }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    data.deletePost(params.id)
    return res.redirect(routes.posts.index.href())
  },
  // Comments routes using resources
  comments: {
    create: {
      middleware: [requireAuth()],
      async handler({ params, formData, session }) {
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
    },
    show({ params }) {
      // Show individual comment - redirect to post for now
      let comment = data.getComment(params.commentId)
      if (!comment) {
        return new Response('Comment not found', { status: 404 })
      }
      return res.redirect(routes.posts.show.href({ id: comment.postId }))
    },
    destroy: {
      middleware: [requireAuth(), requireCommentAuthor()],
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
})

// Middleware to check if user is the author of the comment
function requireCommentAuthor(): Middleware<any, { id: string; commentId: string }> {
  return async (context, next) => {
    let username = context.session.get('username')
    let commentId = (context.params as { commentId: string }).commentId
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
