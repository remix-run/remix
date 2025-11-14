import { routes } from '../routes.ts'
import type { Post } from '../data.ts'

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getPostHrefParams(post: Post) {
  let year = String(post.createdAt.getFullYear())
  let month = String(post.createdAt.getMonth() + 1).padStart(2, '0')
  let day = String(post.createdAt.getDate()).padStart(2, '0')
  return { year, month, day, slug: generateSlug(post.title) }
}

export function loginUrl(redirectTo: FormDataEntryValue | null): string {
  if (!redirectTo || typeof redirectTo !== 'string') {
    return routes.login.index.href()
  }
  return `${routes.login.index.href()}?redirectTo=${encodeURIComponent(redirectTo)}`
}
