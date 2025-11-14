import { html, type SafeHtml } from '@remix-run/html-template'

import { routes } from '../routes.ts'

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
