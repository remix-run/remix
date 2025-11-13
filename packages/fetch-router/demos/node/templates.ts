import { html, type SafeHtml } from '@remix-run/html-template'

import type { Comment, Post } from './data.ts'
import { routes } from './routes.ts'

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

export function homePage(posts: Post[]) {
  let postsList = posts.map(
    (post) => html`
      <article>
        <h2>
          <a href="${routes.posts.show.href({ id: post.id })}">${post.title}</a>
        </h2>
        <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : null}</p>
        <small>Posted on ${post.createdAt.toLocaleDateString()}</small>
      </article>
    `,
  )

  return html`
    <h1>Blog Posts</h1>
    ${postsList}
  `
}

export function postList(posts: Post[]) {
  let postsList = posts.map(
    (post) => html`
      <article>
        <h2><a href="${routes.posts.show.href({ id: post.id })}">${post.title}</a></h2>
        <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : null}</p>
        <small>Posted on ${post.createdAt.toLocaleDateString()}</small>
      </article>
    `,
  )

  return html`
    <h1>All Posts</h1>
    <p><a href="${routes.posts.new.href()}">Create New Post</a></p>
    ${postsList}
  `
}

export function postDetail(post: Post, comments: Comment[], currentUser?: string) {
  let commentsList = comments.map((comment) => {
    let deleteButton =
      currentUser && currentUser === comment.author
        ? html`
            <form
              method="POST"
              action="${routes.posts.comments.destroy.href({ id: post.id, commentId: comment.id })}"
              style="display: inline;"
            >
              <input type="hidden" name="_method" value="DELETE" />
              <button type="submit">Delete</button>
            </form>
          `
        : null
    return html`
      <div>
        <strong>${comment.author}</strong>
        <p>${comment.content}</p>
        <small>${comment.createdAt.toLocaleDateString()}</small>
        ${deleteButton}
      </div>
    `
  })

  let commentForm = currentUser
    ? html`
        <form method="POST" action="${routes.posts.comments.create.href({ id: post.id })}">
          <h3>Add a Comment</h3>
          <div>
            <textarea name="content" rows="4" required></textarea>
          </div>
          <button type="submit">Post Comment</button>
        </form>
      `
    : html`<p><a href="${routes.login.index.href()}">Login</a> to add a comment.</p>`

  return html`
    <article>
      <h1>${post.title}</h1>
      <p><a href="${routes.posts.index.href()}">← Back to Posts</a></p>
      <p><a href="${routes.posts.edit.href({ id: post.id })}">Edit Post</a></p>
      <form
        method="POST"
        action="${routes.posts.destroy.href({ id: post.id })}"
        style="display: inline;"
      >
        <input type="hidden" name="_method" value="DELETE" />
        <button type="submit">Delete Post</button>
      </form>
      <div>${post.content}</div>
      <small>Posted on ${post.createdAt.toLocaleDateString()}</small>
      ${post.updatedAt.getTime() !== post.createdAt.getTime()
        ? `<small>Updated on ${post.updatedAt.toLocaleDateString()}</small>`
        : null}
    </article>
    <section>
      <h2>Comments</h2>
      ${commentsList || '<p>No comments yet.</p>'} ${commentForm}
    </section>
  `
}

export function postForm(post?: Post) {
  let action = post ? routes.posts.update.href({ id: post.id }) : routes.posts.create.href()
  let heading = post ? 'Edit Post' : 'New Post'

  return html`
    <h1>${heading}</h1>
    <form method="POST" action="${action}">
      ${post ? '<input type="hidden" name="_method" value="PUT">' : null}
      <div>
        <label for="title">Title</label>
        <input type="text" id="title" name="title" value="${post?.title}" required />
      </div>
      <div>
        <label for="content">Content</label>
        <textarea id="content" name="content" rows="10" required>${post?.content}</textarea>
      </div>
      <button type="submit">${post ? 'Update' : 'Create'} Post</button>
    </form>
    <p>
      <a href="${routes.posts.index.href()}">← Back to Posts</a>
    </p>
  `
}

export function loginForm(error?: string) {
  return html`
    <h1>Login</h1>
    ${error ? html`<p style="color: red;">${error}</p>` : null}
    <form method="POST" action="${routes.login.action.href()}">
      <div>
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required />
      </div>
      <div>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="off" / />
      </div>
      <button type="submit">Login</button>
    </form>
    <p><a href="${routes.home.href()}">← Back to Home</a></p>
  `
}
