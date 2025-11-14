import { generateSlug } from './app/utils.ts'

export interface Post {
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface Comment {
  id: string
  postSlug: string
  author: string
  content: string
  createdAt: Date
}

// In-memory data stores
let posts = new Map<string, Post>()
let comments = new Map<string, Comment>()

// Initialize with some sample data
let post1: Post = {
  title: 'Welcome to the Blog',
  content: 'This is the first post on our blog demo.',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

let post2: Post = {
  title: 'Getting Started with fetch-router',
  content: 'fetch-router is a minimal, composable router built on the web Fetch API.',
  createdAt: new Date('2025-01-02'),
  updatedAt: new Date('2025-01-02'),
}

let post3: Post = {
  title: 'HTML & XSS Prevention',
  content:
    'When building web apps, you need to escape HTML entities like &, <, >, and " to prevent XSS attacks. Always use proper escaping!',
  createdAt: new Date('2025-01-03'),
  updatedAt: new Date('2025-01-03'),
}

let post1Slug = generateSlug(post1.title)
let post2Slug = generateSlug(post2.title)
let post3Slug = generateSlug(post3.title)

posts.set(post1Slug, post1)
posts.set(post2Slug, post2)
posts.set(post3Slug, post3)

let comment1: Comment = {
  id: '1',
  postSlug: post1Slug,
  author: 'Alice',
  content: 'Great first post!',
  createdAt: new Date('2024-01-01T12:00:00'),
}

comments.set(comment1.id, comment1)

// Helper functions
export function getPosts() {
  return Array.from(posts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getPost(slug: string) {
  return posts.get(slug)
}

export function createPost(title: string, content: string) {
  let now = new Date()
  let slug = generateSlug(title)
  let post: Post = {
    title,
    content,
    createdAt: now,
    updatedAt: now,
  }
  posts.set(slug, post)
  return post
}

export function updatePost(slug: string, title: string, content: string) {
  let post = posts.get(slug)
  if (!post) return undefined

  let oldSlug = slug
  let newSlug = generateSlug(title)

  post.title = title
  post.content = content
  post.updatedAt = new Date()

  // If slug changed, update the map key
  if (oldSlug !== newSlug) {
    posts.delete(oldSlug)
    posts.set(newSlug, post)
  }

  return post
}

export function getComments(postSlug: string) {
  return Array.from(comments.values())
    .filter((c) => c.postSlug === postSlug)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function addComment(postSlug: string, author: string, content: string) {
  let id = String(comments.size + 1)
  let comment: Comment = {
    id,
    postSlug,
    author,
    content,
    createdAt: new Date(),
  }
  comments.set(id, comment)
  return comment
}

export function getComment(id: string) {
  return comments.get(id)
}

export function deleteComment(id: string) {
  return comments.delete(id)
}

export function deletePost(slug: string) {
  // Also delete all comments for this post
  for (let [commentId, comment] of comments.entries()) {
    if (comment.postSlug === slug) {
      comments.delete(commentId)
    }
  }
  return posts.delete(slug)
}
