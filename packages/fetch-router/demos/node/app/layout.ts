import { html, type SafeHtml } from '@remix-run/html-template'

import { routes } from '../routes.ts'

export function layout(body: SafeHtml | string, currentUser?: string) {
  return html`
    <!doctype html>
    <html>
      <head>
        <title>Blog Demo</title>
        <meta charset="utf-8" />
      </head>
      <body>
        <nav>
          <a href="${routes.home.href()}">Home</a>
          <a href="${routes.posts.index.href()}">Posts</a>
          <a href="${routes.posts.new.href()}">New Post</a>
          ${currentUser
            ? html`<span>
                Logged in as ${currentUser} |
                <form method="POST" action="${routes.logout.href()}" style="display: inline;">
                  <button type="submit">Logout</button>
                </form>
              </span>`
            : html`<a href="${routes.login.index.href()}">Login</a>`}
        </nav>
        <main>${body}</main>
      </body>
    </html>
  `
}
