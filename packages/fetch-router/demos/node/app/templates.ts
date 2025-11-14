import { html, type SafeHtml } from '@remix-run/html-template'

import type { Post } from '../data.ts'
import { routes } from '../routes.ts'
import { getPostHrefParams } from './utils.ts'

export function layout(body: SafeHtml | string, currentUser?: string) {
  return html`
    <!doctype html>
    <html>
      <head>
        <title>Blog Demo</title>
        <meta charset="utf-8" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <nav>
          <div class="nav-links flex flex-center">
            <a href="${routes.home.href()}">Home</a>
            <a href="${routes.posts.index.href()}">Posts</a>
            <a href="${routes.posts.new.href()}">New Post</a>
          </div>
          ${currentUser
            ? html`<div class="nav-user flex flex-center">
                <span>${currentUser}</span>
                <form method="POST" action="${routes.logout.href()}">
                  <button type="submit">Logout</button>
                </form>
              </div>`
            : html`<a href="${routes.login.index.href()}">Login</a>`}
        </nav>
        <main>${body}</main>
      </body>
    </html>
  `
}

export function postListItem(post: Post) {
  return html`
    <article class="last-child-no-border">
      <h2>
        <a href="${routes.posts.show.href(getPostHrefParams(post))}">${post.title}</a>
      </h2>
      <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : null}</p>
      <div class="post-meta flex">
        <small>Posted on ${post.createdAt.toLocaleDateString()}</small>
      </div>
    </article>
  `
}

export function redirectToInput(redirectTo: string | null): SafeHtml | null {
  return redirectTo ? html`<input type="hidden" name="redirectTo" value="${redirectTo}" />` : null
}
