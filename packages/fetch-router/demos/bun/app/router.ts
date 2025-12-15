import { createRouter } from '@remix-run/fetch-router'
import { createCookie } from '@remix-run/cookie'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { formData } from '@remix-run/form-data-middleware'
import { logger } from '@remix-run/logger-middleware'
import { session } from '@remix-run/session-middleware'
import { html } from '@remix-run/html-template'
import { createHtmlResponse } from '@remix-run/response/html'
import { createRedirectResponse as redirect } from '@remix-run/response/redirect'
import type { Middleware } from '@remix-run/fetch-router'

import { routes } from './routes.ts'
import * as data from './data.ts'
import path from 'node:path'

let sessionCookie = createCookie('__sess', {
  secrets: ['s3cr3t'],
})
let sessionStorage = createCookieSessionStorage()

function requireAuth(): Middleware {
  return ({ session }, next) => {
    let username = session.get('username')

    if (!username) {
      return redirect(routes.login.index.href())
    }

    return next()
  }
}

export let router = createRouter({
  middleware: [logger(), formData(), session(sessionCookie, sessionStorage)],
})

router.map(routes.home, ({ session }) => {
  let posts = data.getPosts()
  let username = session.get('username') as string | undefined

  return createHtmlResponse(html`
    <html>
      <head>
        <title>Simple Blog - fetch-router Demo</title>
        <meta charset="utf-8" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <nav>
          <h1>Simple Blog</h1>
          <div>
            ${username
              ? html`
                  <span>Hello, ${username}!</span>
                  <form
                    method="POST"
                    action="${routes.logout.href()}"
                    style="display: inline; margin-left: 10px;"
                  >
                    <button type="submit">Logout</button>
                  </form>
                  <a href="${routes.posts.new.href()}" style="margin-left: 10px;">New Post</a>
                `
              : html`<a href="${routes.login.index.href()}">Login</a>`}
          </div>
        </nav>
        <main>
          ${posts.length === 0 ? html`<p>No posts yet.</p>` : null}
          ${posts.map(
            (post) => html`
              <article>
                <h2><a href="${routes.posts.show.href({ id: post.id })}">${post.title}</a></h2>
                <p>${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>
                <div>By ${post.author} on ${post.createdAt.toLocaleDateString()}</div>
              </article>
            `,
          )}
        </main>
      </body>
    </html>
  `)
})

router.map(routes.login, {
  index({ session }) {
    let username = session.get('username') as string | undefined
    if (username) {
      return redirect(routes.home.href())
    }

    return createHtmlResponse(html`
      <html>
        <head>
          <title>Login - Simple Blog</title>
          <meta charset="utf-8" />
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body>
          <h1>Login</h1>
          <p>Enter any username to login (no password required for demo)</p>
          <form method="POST" action="${routes.login.action.href()}">
            <div style="display: flex; flex-direction: column; gap: 10px; width: 150px;">
              <label for="username">Username:</label>
              <input type="text" id="username" name="username" required />
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" required />
            </div>
            <br />
            <button type="submit">Login</button>
          </form>
          <p><a href="${routes.home.href()}">← Back to Home</a></p>
        </body>
      </html>
    `)
  },
  async action({ formData, session }) {
    let username = formData.get('username') as string

    if (username) {
      session.set('username', username)
      return redirect(routes.home.href())
    }

    return redirect(routes.login.index.href())
  },
})

router.post(routes.logout, ({ session }) => {
  session.destroy()
  return redirect(routes.home.href())
})

router.map(routes.posts, {
  new: {
    middleware: [requireAuth()],
    action() {
      return createHtmlResponse(html`
        <html>
          <head>
            <title>New Post - Simple Blog</title>
            <meta charset="utf-8" />
            <link rel="icon" href="/favicon.ico" />
          </head>
          <body>
            <h1>New Post</h1>
            <form method="POST" action="${routes.posts.create.href()}">
              <div>
                <label for="title">Title:</label>
                <input type="text" id="title" name="title" required />
              </div>
              <div>
                <label for="content">Content:</label>
                <textarea id="content" name="content" required></textarea>
              </div>
              <button type="submit">Create Post</button>
            </form>
            <p><a href="${routes.home.href()}">← Back to Home</a></p>
          </body>
        </html>
      `)
    },
  },
  async create({ formData, session }) {
    let username = session.get('username') as string
    if (!username) {
      return redirect(routes.login.index.href())
    }

    let title = formData.get('title') as string
    let content = formData.get('content') as string

    if (!title || !content) {
      return redirect(routes.posts.new.href())
    }

    let post = data.createPost(title, content, username)
    return redirect(routes.posts.show.href({ id: post.id }))
  },
  show({ params }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    return createHtmlResponse(html`
      <html>
        <head>
          <title>${post.title} - Simple Blog</title>
          <meta charset="utf-8" />
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body>
          <h1>${post.title}</h1>
          <div>By ${post.author} on ${post.createdAt.toLocaleDateString()}</div>
          <div>${post.content.replace(/\n/g, '<br>')}</div>
          <p><a href="${routes.home.href()}">← Back to Home</a></p>
        </body>
      </html>
    `)
  },
})

const __dirname = new URL('.', import.meta.url).pathname
const publicDir = path.resolve(__dirname, '../public')

// Serve static files from the public directory
router.get('/*', async ({ request }) => {
  let file = Bun.file(path.join(publicDir, new URL(request.url).pathname))

  if (await file.exists()) {
    return new Response(file)
  }

  return new Response('Not Found', { status: 404 })
})
