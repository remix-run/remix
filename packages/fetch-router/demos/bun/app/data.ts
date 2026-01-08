export interface Post {
  id: string
  title: string
  content: string
  author: string
  createdAt: Date
}

let posts: Post[] = [
  {
    id: '1',
    title: 'Welcome to the Blog',
    content: 'This is a simple blog demo built with fetch-router on Bun.',
    author: 'Admin',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: '2',
    title: 'Getting Started with fetch-router',
    content: 'fetch-router is a minimal, composable router built on the web Fetch API.',
    author: 'Admin',
    createdAt: new Date('2025-01-02'),
  },
]

export function getPosts() {
  return posts.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function getPost(id: string) {
  return posts.find((p) => p.id === id)
}

export function createPost(title: string, content: string, author: string) {
  let post: Post = {
    id: String(posts.length + 1),
    title,
    content,
    author,
    createdAt: new Date(),
  }
  posts.push(post)
  return post
}
