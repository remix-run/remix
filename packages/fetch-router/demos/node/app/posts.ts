import type { RouteHandlers } from '@remix-run/fetch-router'
import * as res from '@remix-run/fetch-router/response-helpers'

import { routes } from '../routes.ts'
import * as templates from './layout.ts'
import * as data from '../data.ts'
import type { Post } from '../data.ts'
import { html } from '@remix-run/html-template'

function postForm(post?: Post) {
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

export let posts = {
  index({ session }) {
    let posts = data.getPosts()
    let currentUser = session.get('username') as string | undefined

    return res.html(
      templates.layout(
        html`
          <h1>All Posts</h1>
          <p><a href="${routes.posts.new.href()}">Create New Post</a></p>
          ${posts.map(
            (post) => html`
              <article>
                <h2><a href="${routes.posts.show.href({ id: post.id })}">${post.title}</a></h2>
                <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : null}</p>
                <small>Posted on ${post.createdAt.toLocaleDateString()}</small>
              </article>
            `,
          )}
        `,
        currentUser,
      ),
    )
  },
  new({ session }) {
    let currentUser = session.get('username') as string | undefined
    return res.html(templates.layout(postForm(), currentUser))
  },
  create({ formData }) {
    let title = formData.get('title') as string
    let content = formData.get('content') as string

    if (!title || !content) {
      return res.html(templates.layout(postForm()), { status: 400 })
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

    // TODO: add a "?redirectTo=..." to the form action to redirect to the post after logging in

    return res.html(
      templates.layout(
        html`
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
            ${comments.length > 0
              ? comments.map((comment) => {
                  let isCommentAuthor = currentUser && currentUser === comment.author
                  return html`
                    <div>
                      <strong>${comment.author}</strong>
                      <p>${comment.content}</p>
                      <small>${comment.createdAt.toLocaleDateString()}</small>
                      ${isCommentAuthor
                        ? html`
                            <form
                              method="POST"
                              action="${routes.posts.comment.destroy.href({
                                id: post.id,
                                commentId: comment.id,
                              })}"
                              style="display: inline;"
                            >
                              <input type="hidden" name="_method" value="DELETE" />
                              <button type="submit">Delete</button>
                            </form>
                          `
                        : null}
                    </div>
                  `
                })
              : html`<p>No comments yet.</p>`}
            ${currentUser
              ? html`
                  <form method="POST" action="${routes.posts.comment.create.href({ id: post.id })}">
                    <h3>Add a Comment</h3>
                    <div>
                      <textarea name="content" rows="4" required></textarea>
                    </div>
                    <button type="submit">Post Comment</button>
                  </form>
                `
              : html`<p><a href="${routes.login.index.href()}">Login</a> to add a comment.</p>`}
          </section>
        `,
        currentUser,
      ),
    )
  },
  edit({ params, session }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    let currentUser = session.get('username') as string | undefined
    return res.html(templates.layout(postForm(post), currentUser))
  },
  update({ params, formData }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    let title = formData.get('title') as string
    let content = formData.get('content') as string

    if (!title || !content) {
      return res.html(templates.layout(postForm(post)), { status: 400 })
    }

    data.updatePost(params.id, title, content)
    return res.redirect(routes.posts.show.href({ id: params.id }))
  },
  destroy({ params }) {
    let post = data.getPost(params.id)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    data.deletePost(params.id)
    return res.redirect(routes.posts.index.href())
  },
} satisfies RouteHandlers<Omit<typeof routes.posts, 'comment'>>
