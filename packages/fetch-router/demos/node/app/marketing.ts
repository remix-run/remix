import type { BuildRouteHandler } from '@remix-run/fetch-router'
import * as res from '@remix-run/fetch-router/response-helpers'
import { routes } from '../routes.ts'

import * as templates from './layout.ts'
import * as data from '../data.ts'
import { html } from '@remix-run/html-template'

export let home: BuildRouteHandler<'GET', typeof routes.home> = ({ session }) => {
  let posts = data.getPosts()
  let currentUser = session.get('username') as string | undefined

  return res.html(
    templates.layout(
      html`
        <h1>Blog Posts</h1>
        ${posts.map(
          (post) => html`
            <article>
              <h2>
                <a href="${routes.posts.show.href({ id: post.id })}">${post.title}</a>
              </h2>
              <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : null}</p>
              <small>Posted on ${post.createdAt.toLocaleDateString()}</small>
            </article>
          `,
        )}
      `,
      currentUser,
    ),
  )
}
