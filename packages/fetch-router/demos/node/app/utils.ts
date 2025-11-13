import type { Post } from '../data.ts'

// Helper function to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Helper function to get href params from a post
export function getPostHrefParams(post: Post) {
  let year = String(post.createdAt.getFullYear())
  let month = String(post.createdAt.getMonth() + 1).padStart(2, '0')
  let day = String(post.createdAt.getDate()).padStart(2, '0')
  return { year, month, day, slug: generateSlug(post.title) }
}
