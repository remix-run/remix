import type { BuildAction } from 'remix/fetch-router'
import type { RemixNode } from 'remix/component'
import { Auth } from 'remix/auth-middleware'
import type { Auth as RequestAuth } from 'remix/auth-middleware'

import type { SocialLoginConfig } from './config.ts'
import { Layout } from './layout.tsx'
import { routes } from './routes.ts'
import {
  getProviderLabel,
  getSocialProviderStates,
  type SocialProviderState,
  type SocialUser,
} from './middleware/auth.ts'
import { render } from './utils/render.ts'
import { Session } from './utils/session.ts'

export function createHomeAction(
  config: SocialLoginConfig,
): BuildAction<'GET', typeof routes.home> {
  return {
    action({ get }) {
      let session = get(Session)
      let auth = get(Auth) as RequestAuth<SocialUser, string>
      let error = session.get('error')
      let user = auth.ok ? auth.identity : null
      let providers = getSocialProviderStates(config)

      return render(
        <Layout>
          <section class="hero">
            <p class="eyebrow">Remix Auth Demo</p>
            <h1>Social login with first-party request handlers</h1>
            <p class="lede">
              This demo uses <code>login()</code>, <code>callback()</code>, <code>auth()</code>,
              and <code>sessionAuth()</code> to move from Google, GitHub, and Facebook into
              request-scoped identity.
            </p>
          </section>

          {typeof error === 'string' ? <div class="notice notice-error">{error}</div> : null}

          {user ? <SignedInState user={user} /> : <SignedOutState providers={providers} />}
        </Layout>,
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    },
  }
}

function SignedOutState() {
  return ({ providers }: { providers: SocialProviderState[] }) => {
    let unavailableProviders = providers.filter(provider => !provider.configured)

    return (
      <section class="panel stack-lg">
        <div>
          <h2>Choose a provider</h2>
          <p class="muted">
            Each button starts an OAuth flow with <code>remix/auth</code>. After the callback, the
            demo stores a compact auth record in the session and resolves it on later requests with{' '}
            <code>sessionAuth()</code>.
          </p>
        </div>

        <div class="provider-list">
          {providers.map(provider => {
            let href = getProviderLoginHref(provider.name)
            let className = `provider-button provider-${provider.name}`

            return (
              <div class="provider-card">
                {provider.configured ? (
                  <a href={href} class={className}>
                    Continue with {provider.label}
                  </a>
                ) : (
                  <button type="button" class={className} disabled>
                    Continue with {provider.label}
                  </button>
                )}
                {provider.configured ? (
                  <p class="provider-copy">Configured and ready for local OAuth testing.</p>
                ) : (
                  <p class="provider-copy">
                    Set {provider.missingEnv.join(' and ')} to enable {provider.label}.
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {unavailableProviders.length > 0 ? (
          <div class="setup-card">
            <h3>Local setup</h3>
            <p class="muted">
              Register these callback URLs with your provider apps while developing on port 44100.
            </p>
            <ul class="callback-list">
              <li>
                Google: <code>{routes.auth.google.callback.href()}</code>
              </li>
              <li>
                GitHub: <code>{routes.auth.github.callback.href()}</code>
              </li>
              <li>
                Facebook: <code>{routes.auth.facebook.callback.href()}</code>
              </li>
            </ul>
          </div>
        ) : null}
      </section>
    )
  }
}

function SignedInState() {
  return ({ user }: { user: SocialUser }) => (
    <section class="panel stack-lg">
      <div class="identity-row">
        <Avatar user={user} />
        <div class="stack-sm">
          <p class="eyebrow">Signed in with {getProviderLabel(user.provider)}</p>
          <h2>{user.name ?? user.email ?? 'Authenticated user'}</h2>
          <p class="muted">
            The current request was authenticated from the session, and the app is reading the
            resolved identity from <code>context.get(Auth)</code>.
          </p>
        </div>
      </div>

      <dl class="details-grid">
        <Detail label="Provider" value={getProviderLabel(user.provider)} />
        <Detail label="Provider account" value={user.providerAccountId} />
        <Detail label="Email" value={user.email ?? 'Not provided'} />
        <Detail label="Avatar URL" value={user.avatarUrl ?? 'Not provided'} />
      </dl>

      <form method="POST" action={routes.auth.logout.href()}>
        <button type="submit" class="logout-button">
          Log out
        </button>
      </form>
    </section>
  )
}

function Avatar() {
  return ({ user }: { user: SocialUser }) => {
    if (user.avatarUrl) {
      return <img class="avatar" src={user.avatarUrl} alt="Authenticated user avatar" />
    }

    return <div class="avatar avatar-fallback">{getInitials(user)}</div>
  }
}

function Detail() {
  return ({ label, value }: { label: string; value: RemixNode }) => (
    <div class="detail-card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function getProviderLoginHref(name: SocialProviderState['name']): string {
  switch (name) {
    case 'google':
      return routes.auth.google.login.href()
    case 'github':
      return routes.auth.github.login.href()
    case 'facebook':
      return routes.auth.facebook.login.href()
  }

  return routes.home.href()
}

function getInitials(user: SocialUser): string {
  let source = user.name ?? user.email ?? getProviderLabel(user.provider)
  let parts = source.split(/\s+/).filter(Boolean)
  let initials = parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')

  return initials || 'U'
}
