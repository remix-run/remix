import { createHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { html } from './utils/response.ts'

export const blogHandlers = createHandlers(routes.blog, {
  index() {
    return html(renderBlogIndex())
  },
  show({ params }) {
    return html(renderBlogPost(params.slug))
  },
  new() {
    return html(renderNewPostForm())
  },
  async create({ request }) {
    let post = await request.json()
    return new Response(`Created blog post: ${post.title}`, { status: 201 })
  },
  edit({ params }) {
    return html(renderEditForm(params.slug))
  },
  async update({ params }) {
    return new Response(`Updated blog post: ${params.slug}`)
  },
  destroy({ params }) {
    return new Response(`Deleted blog post: ${params.slug}`)
  },
})

function renderBlogIndex() {
  return `
    <html>
      <head><title>Blog - Bookstore</title></head>
      <body>
        <h1>📝 Blog Posts</h1>
        <article><h2><a href="${routes.blog.show.href({ slug: 'getting-started' })}">Getting Started with Reading</a></h2></article>
        <article><h2><a href="${routes.blog.show.href({ slug: 'best-books-2024' })}">Best Books of 2024</a></h2></article>
        <article><h2><a href="${routes.blog.show.href({ slug: 'author-spotlight' })}">Author Spotlight</a></h2></article>
        <p><a href="${routes.blog.new.href()}">Write New Post</a> (Admin)</p>
      </body>
    </html>
  `
}

function renderBlogPost(slug: string) {
  return `
    <html>
      <head><title>${slug} - Blog</title></head>
      <body>
        <article>
          <h1>📖 ${slug.replace('-', ' ').toUpperCase()}</h1>
          <p>This is the content for the blog post about ${slug}.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        </article>
        <p><a href="${routes.blog.edit.href({ slug })}">Edit Post</a> (Admin)</p>
      </body>
    </html>
  `
}

function renderNewPostForm() {
  return `
    <html>
      <head><title>New Post - Blog</title></head>
      <body>
        <h1>Create New Blog Post</h1>
        <form>
          <p><label>Title: <input name="title" required></label></p>
          <p><label>Slug: <input name="slug" required></label></p>
          <p><label>Content: <textarea name="content" required></textarea></label></p>
          <p><button type="submit">Create Post</button></p>
        </form>
      </body>
    </html>
  `
}

function renderEditForm(slug: string) {
  return `
    <html>
      <head><title>Edit ${slug} - Blog</title></head>
      <body>
        <h1>Edit Blog Post: ${slug}</h1>
        <form>
          <p><label>Title: <input name="title" value="${slug}"></label></p>
          <p><label>Content: <textarea name="content">Content for ${slug}</textarea></label></p>
          <p><button type="submit">Update Post</button></p>
        </form>
      </body>
    </html>
  `
}
