import type { BuildAction } from 'remix/fetch-router'
import { Auth } from 'remix/auth-middleware'
import type { Auth as RequestAuth } from 'remix/auth-middleware'

import type { SocialLoginConfig } from './config.ts'
import { Layout } from './layout.tsx'
import {
  getLoginMethodLabel,
  getProviderLabel,
  getSocialProviderStates,
  type AuthenticatedUser,
  type SocialProviderState,
} from './middleware/auth.ts'
import { routes } from './routes.ts'
import { render } from './utils/render.ts'
import { Session } from './utils/session.ts'

let localDemoOrigin = 'http://127.0.0.1:44100'

export function createHomeAction(
  config: SocialLoginConfig,
): BuildAction<'GET', typeof routes.home> {
  return {
    action({ get }) {
      let session = get(Session)
      let auth = get(Auth) as RequestAuth<AuthenticatedUser, string>
      let error = session.get('error')
      let user = auth.ok ? auth.identity : null
      let providers = getSocialProviderStates(config)

      return render(
        <Layout>
          <section class="page-stage">
            <section class="hero page-hero stack-sm">
              <h1>Remix Auth Demo</h1>
              <p class="lede">
                Sign in with the seeded local account or connect a social provider. The demo keeps
                users in SQLite and resolves request identity from <code>context.get(Auth)</code>.
              </p>
            </section>

            <section class="content-stage">
              {typeof error === 'string' ? <div class="notice notice-error">{error}</div> : null}

              {user ? <SignedInState user={user} /> : <SignedOutState providers={providers} />}

              <SetupGuide providers={providers} />
            </section>
          </section>
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
  return ({ providers }: { providers: SocialProviderState[] }) => (
    <section class="panel auth-card auth-split">
      <div class="credentials-pane stack-lg">
        <div class="stack-sm">
          <p class="eyebrow">Welcome back</p>
          <h2>Login to your account</h2>
          <p class="muted">
            Use the seeded local account or any configured social provider. The session stores a
            compact auth record, and <code>createSessionAuthScheme()</code> resolves the current user on later
            requests.
          </p>
        </div>

        <form method="POST" action={routes.auth.login.action.href()} class="credentials-form">
          <div class="form-grid">
            <label class="field">
              <span class="field-label">Email</span>
              <input
                class="field-input"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="demo@example.com"
                required
              />
            </label>
            <label class="field">
              <span class="field-label">Password</span>
              <input
                class="field-input"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="password123"
                required
              />
            </label>
          </div>

          <button type="submit" class="primary-button">
            Login
          </button>
        </form>

        <div class="demo-account">
          <p class="demo-account-label">Seeded local account</p>
          <p class="muted">
            <strong>demo@example.com</strong> / <strong>password123</strong>
          </p>
        </div>
      </div>

      <div class="auth-divider">
        <span>OR</span>
      </div>

      <aside class="social-pane stack-lg">
        <div class="stack-sm">
          <p class="eyebrow">You can</p>
          <h2>Login with</h2>
          <p class="muted">Use any configured provider to create or resume a local account.</p>
        </div>

        <div class="provider-list">
          {providers.map((provider) => {
            let href = getProviderLoginHref(provider.name)
            let className = `provider-button provider-${provider.name}`

            return provider.configured ? (
              <a href={href} class={className}>
                <span class="provider-mark">
                  <img
                    class={`provider-icon provider-icon-${provider.name}`}
                    src={getProviderIconHref(provider.name)}
                    alt=""
                  />
                </span>
                <span class="provider-body">
                  <span class="provider-title">Login with {provider.label}</span>
                </span>
              </a>
            ) : (
              <button type="button" class={className} disabled>
                <span class="provider-mark">
                  <img
                    class={`provider-icon provider-icon-${provider.name}`}
                    src={getProviderIconHref(provider.name)}
                    alt=""
                  />
                </span>
                <span class="provider-body">
                  <span class="provider-title">Login with {provider.label}</span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    </section>
  )
}

function SetupGuide() {
  return ({ providers }: { providers: SocialProviderState[] }) => (
    <section class="setup-section">
      <div class="setup-card setup-guide-card stack-lg">
        <div class="stack-sm">
          <p class="eyebrow">Demo setup</p>
          <h2>Configure local and social authentication</h2>
          <p class="muted">
            Copy <code>.env.example</code> to .env, paste whichever client IDs and client secrets
            you want to test, then restart the server. The seeded email/password login works even if
            every social provider stays disabled.
          </p>
        </div>

        <section class="setup-topic stack-md">
          <h3>Demo setup</h3>
          <div class="setup-columns">
            <div class="stack-sm">
              <h4>Boot the demo</h4>
              <ol class="setup-list">
                <li>
                  Copy <code>.env.example</code> to .env in `demos/social-login`.
                </li>
                <li>Fill in any provider client ID and secret pairs you want to enable.</li>
                <li>Register the callback URLs below with each provider app.</li>
                <li>
                  Run <code>pnpm start</code> and open <code>{localDemoOrigin}/</code>.
                </li>
              </ol>
            </div>

            <div class="stack-sm">
              <h4>Email login</h4>
              <p class="muted">
                The demo seeds one local user into SQLite the first time it boots.
              </p>
              <div class="demo-account demo-account-inline">
                <p class="demo-account-label">Seeded local account</p>
                <p class="muted">
                  <strong>demo@example.com</strong> / <strong>password123</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {providers.map((provider) => (
          <ProviderSetupSection provider={provider} />
        ))}
      </div>
    </section>
  )
}

function ProviderSetupSection() {
  return ({ provider }: { provider: SocialProviderState }) => (
    <section class="setup-topic stack-sm">
      <div class="setup-provider-header">
        <div class="stack-sm">
          <h3>{getProviderSetupHeading(provider.name)}</h3>
        </div>
        <span class={`setup-status ${provider.configured ? 'setup-status-ready' : ''}`}>
          {provider.configured ? 'Enabled' : 'Needs .env'}
        </span>
      </div>

      <p class="muted">{renderProviderSetupDescription(provider.name)}</p>

      <dl class="setup-definition-list">
        <div>
          <dt>Environment variables</dt>
          <dd>
            {getProviderEnvVars(provider.name).map((name) => (
              <code>{name}</code>
            ))}
          </dd>
        </div>
        <div>
          <dt>Callback URL</dt>
          <dd>
            <code>{getProviderCallbackHref(provider.name)}</code>
          </dd>
        </div>
        {provider.name === 'github' ? (
          <div>
            <dt>Homepage URL</dt>
            <dd>
              <code>{localDemoOrigin}/</code>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function SignedInState() {
  return ({ user }: { user: AuthenticatedUser }) => (
    <section class="panel auth-card stack-lg">
      <div class="signed-in-header">
        <p class="eyebrow">Authenticated session</p>
        <span class="status-pill">Signed in</span>
      </div>

      <div class="identity-row">
        <Avatar user={user} />
        <div class="stack-sm">
          <p class="eyebrow">Signed in with {getLoginMethodLabel(user.loginMethod)}</p>
          <h2>{user.name ?? user.email ?? 'Authenticated user'}</h2>
        </div>
      </div>

      <form method="POST" action={routes.auth.logout.href()}>
        <button type="submit" class="logout-button">
          Log out
        </button>
      </form>
    </section>
  )
}

function Avatar() {
  return ({ user }: { user: AuthenticatedUser }) => {
    if (user.avatarUrl) {
      return <img class="avatar" src={user.avatarUrl} alt="Authenticated user avatar" />
    }

    return <div class="avatar avatar-fallback">{getInitials(user)}</div>
  }
}

function getProviderIconHref(name: SocialProviderState['name']): string {
  switch (name) {
    case 'google':
      return '/icons/google.svg'
    case 'github':
      return '/icons/github.svg'
    case 'x':
      return '/icons/x.svg'
  }
}

function getProviderLoginHref(name: SocialProviderState['name']): string {
  switch (name) {
    case 'google':
      return routes.auth.google.login.href()
    case 'github':
      return routes.auth.github.login.href()
    case 'x':
      return routes.auth.x.login.href()
  }
}

function getProviderCallbackHref(name: SocialProviderState['name']): string {
  switch (name) {
    case 'google':
      return `${localDemoOrigin}${routes.auth.google.callback.href()}`
    case 'github':
      return `${localDemoOrigin}${routes.auth.github.callback.href()}`
    case 'x':
      return `${localDemoOrigin}${routes.auth.x.callback.href()}`
  }
}

function getProviderEnvVars(name: SocialProviderState['name']): string[] {
  switch (name) {
    case 'google':
      return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    case 'github':
      return ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']
    case 'x':
      return ['X_CLIENT_ID', 'X_CLIENT_SECRET']
  }
}

function getProviderSetupHeading(name: SocialProviderState['name']): string {
  switch (name) {
    case 'google':
      return 'Create a Google web OAuth client'
    case 'github':
      return 'Create a GitHub OAuth app'
    case 'x':
      return 'Create an X app'
  }
}

function renderProviderSetupDescription(name: SocialProviderState['name']) {
  switch (name) {
    case 'google':
      return (
        <>
          Create a{' '}
          <a
            href="https://developers.google.com/identity/protocols/oauth2/web-server"
            target="_blank"
            rel="noreferrer"
          >
            Web application OAuth client in Google Cloud
          </a>
          , add <code>{getProviderCallbackHref('google')}</code> as an authorized redirect URI,
          then copy the client ID and client secret into .env.
        </>
      )
    case 'github':
      return (
        <>
          Create an{' '}
          <a
            href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
            target="_blank"
            rel="noreferrer"
          >
            OAuth App in GitHub settings
          </a>
          , set <code>{localDemoOrigin}/</code> as the homepage URL and{' '}
          <code>{getProviderCallbackHref('github')}</code> as the authorization callback URL, then
          copy the client ID and client secret into .env.
        </>
      )
    case 'x':
      return (
        <>
          Create an{' '}
          <a
            href="https://docs.x.com/fundamentals/developer-portal"
            target="_blank"
            rel="noreferrer"
          >
            app in the X Developer Portal
          </a>
          , enable{' '}
          <a
            href="https://docs.x.com/x-for-websites/log-in-with-x/guides/browser-sign-in-flow"
            target="_blank"
            rel="noreferrer"
          >
            Sign in with X
          </a>
          , register <code>{getProviderCallbackHref('x')}</code> as the callback URL, then copy the
          client ID and client secret into .env. Open the demo at <code>{localDemoOrigin}/</code>{' '}
          when you test the X flow.
        </>
      )
  }
}

function getInitials(user: AuthenticatedUser): string {
  let source = user.name ?? user.email ?? getLoginMethodLabel(user.loginMethod)
  let parts = source.split(/\s+/).filter(Boolean)
  let initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'U'
}
