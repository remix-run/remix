import { routes } from './routes.ts'
import { render } from './utils/render.tsx'
import { getUser } from './utils/auth.ts'
import { getAllPosts, hasLiked } from './models/posts.ts'
import { Layout } from './layout.tsx'

export function home() {
  let user = getUser()
  let posts = getAllPosts()

  return render(
    <Layout>
      <h1
        css={{
          fontSize: '2rem',
          fontWeight: 600,
          marginBottom: '1rem',
          color: '#1d1d1f',
          letterSpacing: '-0.02em',
        }}
      >
        Latest Posts
      </h1>
      <p css={{ fontSize: '1.0625rem', color: '#6e6e73', marginBottom: '2rem' }}>
        Welcome to our community! {user ? `Logged in as ${user.email}` : 'Log in to like posts.'}
      </p>

      <div>
        {posts.map((post) => {
          let liked = user ? hasLiked(post.id, user.id) : false
          let likesCount = post.likes.length

          return (
            <article
              css={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <h2
                css={{
                  fontSize: '1.3125rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: '#1d1d1f',
                  letterSpacing: '-0.01em',
                }}
              >
                {post.title}
              </h2>
              <div css={{ color: '#86868b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                By {post.author}
              </div>
              <p css={{ color: '#1d1d1f', lineHeight: 1.6, marginBottom: '1rem' }}>
                {post.content}
              </p>
              <div
                css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}
              >
                {user ? (
                  <form method="POST" action={routes.posts.like.href({ id: post.id })}>
                    <button
                      type="submit"
                      css={{
                        display: 'inline-block',
                        padding: '0.5rem 1rem',
                        background: liked ? '#f5f5f7' : '#007aff',
                        color: liked ? '#1d1d1f' : 'white',
                        borderRadius: '6px',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: 'none',
                        ':hover': {
                          background: liked ? '#e8e8ed' : '#0051d5',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      {liked ? '❤️ Liked' : '🤍 Like'}
                    </button>
                  </form>
                ) : null}
                <span css={{ color: '#86868b', fontSize: '0.875rem' }}>
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </Layout>,
  )
}
