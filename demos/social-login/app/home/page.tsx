import { css } from 'remix/component'

import { Layout } from '../layout.tsx'
import type { AuthenticatedUser } from '../middleware/auth.ts'
import type { SocialProviderState } from '../social-providers.ts'
import { SetupGuide } from './setup-guide.tsx'
import { SignedInState } from './signed-in-state.tsx'
import { SignedOutState } from './signed-out-state.tsx'
import { noticeStyle, stackSmStyle } from './styles.ts'

interface HomePageProps {
  error: string | null
  user: AuthenticatedUser | null
  providers: SocialProviderState[]
}

export function HomePage() {
  return ({ error, user, providers }: HomePageProps) => (
    <Layout>
      <section mix={css({ display: 'grid', gap: '22px' })}>
        <section
          mix={[
            stackSmStyle,
            css({
              justifyItems: 'center',
              textAlign: 'center',
              color: 'rgba(248, 250, 252, 0.96)',
              paddingTop: '8px',
            }),
          ]}
        >
          <h1
            mix={css({
              margin: 0,
              lineHeight: 1.04,
              fontSize: 'clamp(2.4rem, 5vw, 4rem)',
              letterSpacing: '-0.04em',
              textWrap: 'balance',
            })}
          >
            Remix Auth Demo
          </h1>
          <p
            mix={css({
              margin: 0,
              lineHeight: 1.58,
              maxWidth: '44rem',
              color: 'rgba(241, 245, 249, 0.78)',
            })}
          >
            Sign in with the seeded local account or connect a social provider. The demo keeps
            users in SQLite and resolves request identity from <code>context.get(Auth)</code>.
          </p>
        </section>

        <section
          mix={css({
            display: 'grid',
            gap: '16px',
            justifyItems: 'center',
          })}
        >
          {error ? (
            <div
              mix={[
                noticeStyle,
                css({
                  background: 'var(--error-bg)',
                  color: 'var(--error-text)',
                }),
              ]}
            >
              {error}
            </div>
          ) : null}

          {user ? <SignedInState user={user} /> : <SignedOutState providers={providers} />}

          <SetupGuide providers={providers} />
        </section>
      </section>
    </Layout>
  )
}
