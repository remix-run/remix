export interface Post {
  id: string
  title: string
  author: string
  content: string
  likes: string[] // User IDs who liked this post
}

let initialPosts: Post[] = [
  {
    id: '1',
    title: 'Welcome to the Auth Demo!',
    author: 'Admin',
    content:
      "This is a demo of the new @remix-run/auth package. Try liking posts - you'll need to log in first!",
    likes: [],
  },
  {
    id: '2',
    title: 'Web Standards-Based Authentication',
    author: 'Developer',
    content:
      'This authentication system is built on web standards like the Web Crypto API, making it portable across Node.js, Bun, Deno, and Cloudflare Workers.',
    likes: [],
  },
]

let posts: Post[] = []

export function resetPosts() {
  posts = JSON.parse(JSON.stringify(initialPosts))
}

// Initialize posts on module load
resetPosts()

export function getAllPosts(): Post[] {
  return posts
}

export function getPost(id: string): Post | null {
  return posts.find((post) => post.id === id) || null
}

export function toggleLike(postId: string, userId: string): boolean {
  let post = posts.find((p) => p.id === postId)
  if (!post) return false

  let likeIndex = post.likes.indexOf(userId)
  if (likeIndex === -1) {
    post.likes.push(userId)
    return true
  } else {
    post.likes.splice(likeIndex, 1)
    return false
  }
}

export function hasLiked(postId: string, userId: string): boolean {
  let post = posts.find((p) => p.id === postId)
  return post ? post.likes.includes(userId) : false
}
