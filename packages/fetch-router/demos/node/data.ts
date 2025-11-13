export interface Post {
  id: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface Comment {
  id: string
  postId: string
  author: string
  content: string
  createdAt: Date
}

// In-memory data stores
let posts = new Map<string, Post>()
let comments = new Map<string, Comment>()

// Initialize with some sample data
let post1: Post = {
  id: '1',
  title: 'Welcome to the Blog',
  content: 'This is the first post on our blog demo.',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

let post2: Post = {
  id: '2',
  title: 'Getting Started with fetch-router',
  content: 'fetch-router is a minimal, composable router built on the web Fetch API.',
  createdAt: new Date('2025-01-02'),
  updatedAt: new Date('2025-01-02'),
}

let post3: Post = {
  id: '3',
  title: 'HTML & XSS Prevention',
  content:
    'When building web apps, you need to escape HTML entities like &, <, >, and " to prevent XSS attacks. Always use proper escaping!',
  createdAt: new Date('2025-01-03'),
  updatedAt: new Date('2025-01-03'),
}

posts.set(post1.id, post1)
posts.set(post2.id, post2)
posts.set(post3.id, post3)

let comment1: Comment = {
  id: '1',
  postId: '1',
  author: 'Alice',
  content: 'Great first post!',
  createdAt: new Date('2024-01-01T12:00:00'),
}

comments.set(comment1.id, comment1)

// Helper functions
export function getPosts() {
  return Array.from(posts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getPost(id: string) {
  return posts.get(id)
}

export function createPost(title: string, content: string) {
  let id = String(posts.size + 1)
  let now = new Date()
  let post: Post = {
    id,
    title,
    content,
    createdAt: now,
    updatedAt: now,
  }
  posts.set(id, post)
  return post
}

export function updatePost(id: string, title: string, content: string) {
  let post = posts.get(id)
  if (!post) return undefined

  post.title = title
  post.content = content
  post.updatedAt = new Date()
  return post
}

export function getComments(postId: string) {
  return Array.from(comments.values())
    .filter((c) => c.postId === postId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function addComment(postId: string, author: string, content: string) {
  let id = String(comments.size + 1)
  let comment: Comment = {
    id,
    postId,
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

export function deletePost(id: string) {
  // Also delete all comments for this post
  for (let [commentId, comment] of comments.entries()) {
    if (comment.postId === id) {
      comments.delete(commentId)
    }
  }
  return posts.delete(id)
}
