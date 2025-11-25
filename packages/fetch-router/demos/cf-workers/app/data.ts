export interface Post {
  id: string
  title: string
  content: string
  author: string
  createdAt: Date
}

interface PostRow {
  id: number
  title: string
  content: string
  author: string
  created_at: number
}

function rowToPost(row: PostRow): Post {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    author: row.author,
    createdAt: new Date(row.created_at * 1000),
  }
}

export async function getPosts(db: D1Database): Promise<Post[]> {
  let result = await db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all<PostRow>()
  return result.results.map(rowToPost)
}

export async function getPost(db: D1Database, id: string): Promise<Post | null> {
  let result = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<PostRow>()
  return result ? rowToPost(result) : null
}

export async function createPost(
  db: D1Database,
  title: string,
  content: string,
  author: string,
): Promise<Post> {
  let createdAt = Math.floor(Date.now() / 1000)

  let result = await db
    .prepare('INSERT INTO posts (title, content, author, created_at) VALUES (?, ?, ?, ?)')
    .bind(title, content, author, createdAt)
    .run()

  let id = result.meta.last_row_id

  return {
    id: String(id),
    title,
    content,
    author,
    createdAt: new Date(createdAt * 1000),
  }
}
