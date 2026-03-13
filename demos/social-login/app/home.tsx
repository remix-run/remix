import { Auth } from 'remix/auth-middleware'
import type { Auth as RequestAuth } from 'remix/auth-middleware'
import { css } from 'remix/component'
import type { BuildAction } from 'remix/fetch-router'

import type { SocialLoginConfig } from './config.ts'
import { Layout } from './layout.tsx'
import type { AuthenticatedUser } from './middleware/auth.ts'
import { routes } from './routes.ts'
import {
  getLoginMethodLabel,
  getProviderCallbackHref,
  getProviderEnvVars,
  getProviderIconHref,
  getProviderLoginHref,
  getProviderSetupHeading,
  getSocialProviderStates,
  type SocialProviderName,
  type SocialProviderState,
} from './social-providers.ts'
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
          <section mix={css({ display: 'grid', gap: '22px' })}>
            <section
              mix={[
                stackSmStyle,
                css({
                  justifyItems: 'center',
                  textAlign: 'center',
                  color: '#ffffff',
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
                  color: 'rgba(255, 255, 255, 0.82)',
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
              {typeof error === 'string' ? (
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

interface SignedOutStateProps {
  providers: SocialProviderState[]
}

function SignedOutState() {
  return ({ providers }: SignedOutStateProps) => (
    <section mix={[panelStyle, authCardStyle, authSplitStyle]}>
      <div mix={[credentialsPaneStyle, stackLgStyle]}>
        <div mix={stackSmStyle}>
          <p mix={eyebrowStyle}>Welcome back</p>
          <h2 mix={sectionTitleStyle}>Login to your account</h2>
          <p mix={mutedTextStyle}>
            Use the seeded local account or any configured social provider. The session stores a
            compact auth record, and <code>createSessionAuthScheme()</code> resolves the current
            user on later requests.
          </p>
        </div>

        <form method="POST" action={routes.auth.login.action.href()} mix={credentialsFormStyle}>
          <div mix={formGridStyle}>
            <label mix={fieldStyle}>
              <span mix={fieldLabelStyle}>Email</span>
              <input
                mix={fieldInputStyle}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="demo@example.com"
                required
              />
            </label>
            <label mix={fieldStyle}>
              <span mix={fieldLabelStyle}>Password</span>
              <input
                mix={fieldInputStyle}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="password123"
                required
              />
            </label>
          </div>

          <button type="submit" mix={primaryButtonStyle}>
            Login
          </button>
        </form>

        <div mix={demoAccountStyle}>
          <p mix={demoAccountLabelStyle}>Seeded local account</p>
          <p mix={mutedTextStyle}>
            <strong>demo@example.com</strong> / <strong>password123</strong>
          </p>
        </div>
      </div>

      <div mix={authDividerStyle}>
        <span mix={authDividerBubbleStyle}>OR</span>
      </div>

      <aside mix={[socialPaneStyle, stackLgStyle]}>
        <div mix={stackSmStyle}>
          <p mix={eyebrowStyle}>You can</p>
          <h2 mix={sectionTitleStyle}>Login with</h2>
          <p mix={mutedTextStyle}>Use any configured provider to create or resume a local account.</p>
        </div>

        <div mix={providerListStyle}>
          {providers.map((provider) => (
            <ProviderButton key={provider.name} provider={provider} />
          ))}
        </div>
      </aside>
    </section>
  )
}

interface SetupGuideProps {
  providers: SocialProviderState[]
}

function SetupGuide() {
  return ({ providers }: SetupGuideProps) => (
    <section mix={css({ width: 'min(980px, 100%)' })}>
      <div mix={[setupCardStyle, setupGuideCardStyle, stackLgStyle]}>
        <div mix={stackSmStyle}>
          <p mix={eyebrowStyle}>Demo setup</p>
          <h2 mix={sectionTitleStyle}>Configure local and social authentication</h2>
          <p mix={mutedTextStyle}>
            Copy <code>.env.example</code> to .env, paste whichever client IDs and client secrets
            you want to test, then restart the server. The seeded email/password login works even
            if every social provider stays disabled.
          </p>
        </div>

        <section mix={[setupTopicStyle, stackMdStyle]}>
          <h3 mix={setupHeadingStyle}>Demo setup</h3>
          <div mix={setupColumnsStyle}>
            <div mix={stackSmStyle}>
              <h4 mix={setupSubheadingStyle}>Boot the demo</h4>
              <ol mix={setupListStyle}>
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

            <div mix={stackSmStyle}>
              <h4 mix={setupSubheadingStyle}>Email login</h4>
              <p mix={mutedTextStyle}>
                The demo seeds one local user into SQLite the first time it boots.
              </p>
              <div
                mix={[
                  demoAccountStyle,
                  css({
                    background: '#ffffff',
                  }),
                ]}
              >
                <p mix={demoAccountLabelStyle}>Seeded local account</p>
                <p mix={mutedTextStyle}>
                  <strong>demo@example.com</strong> / <strong>password123</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {providers.map((provider) => (
          <ProviderSetupSection key={provider.name} provider={provider} />
        ))}
      </div>
    </section>
  )
}

interface SignedInStateProps {
  user: AuthenticatedUser
}

function SignedInState() {
  return ({ user }: SignedInStateProps) => (
    <section mix={[panelStyle, authCardStyle, stackLgStyle]}>
      <div
        mix={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '28px 28px 0',
          '@media (max-width: 640px)': {
            paddingLeft: '18px',
            paddingRight: '18px',
          },
        })}
      >
        <p mix={eyebrowStyle}>Authenticated session</p>
        <span
          mix={css({
            borderRadius: '999px',
            padding: '0.42rem 0.85rem',
            background: 'rgba(15, 159, 110, 0.12)',
            color: 'var(--success)',
            fontSize: '0.82rem',
            fontWeight: 700,
          })}
        >
          Signed in
        </span>
      </div>

      <div mix={identityRowStyle}>
        <Avatar user={user} />
        <div mix={stackSmStyle}>
          <p mix={eyebrowStyle}>Signed in with {getLoginMethodLabel(user.loginMethod)}</p>
          <h2 mix={sectionTitleStyle}>{user.name ?? user.email ?? 'Authenticated user'}</h2>
        </div>
      </div>

      <div mix={[profileDumpSectionStyle, stackSmStyle]}>
        <p mix={mutedTextStyle}>
          The following JSON is the resolved auth profile that this request received from{' '}
          <code>context.get(Auth)</code>.
        </p>
        <pre mix={profileDumpStyle}>{JSON.stringify(user, null, 2)}</pre>
      </div>

      <form method="POST" action={routes.auth.logout.href()}>
        <button type="submit" mix={logoutButtonStyle}>
          Log out
        </button>
      </form>
    </section>
  )
}

function Avatar() {
  return ({ user }: SignedInStateProps) => {
    if (user.avatarUrl) {
      return <img mix={avatarStyle} src={user.avatarUrl} alt="Authenticated user avatar" />
    }

    return <div mix={[avatarStyle, avatarFallbackStyle]}>{getInitials(user)}</div>
  }
}

interface ProviderButtonProps {
  provider: SocialProviderState
}

function ProviderButton() {
  return ({ provider }: ProviderButtonProps) => {
    let buttonStyles = [providerButtonStyle, providerThemeStyles[provider.name]]
    let markStyles = [providerMarkStyle, providerMarkThemeStyles[provider.name]]
    let iconStyles =
      provider.name === 'x' ? [providerIconStyle, providerIconInvertedStyle] : [providerIconStyle]
    let body = (
      <>
        <span mix={markStyles}>
          <img mix={iconStyles} src={getProviderIconHref(provider.name)} alt="" />
        </span>
        <span mix={providerBodyStyle}>
          <span mix={providerTitleStyle}>Login with {provider.label}</span>
        </span>
      </>
    )

    if (provider.configured) {
      return (
        <a href={getProviderLoginHref(provider.name)} mix={buttonStyles}>
          {body}
        </a>
      )
    }

    return (
      <button type="button" mix={buttonStyles} disabled>
        {body}
      </button>
    )
  }
}

interface ProviderSetupSectionProps {
  provider: SocialProviderState
}

function ProviderSetupSection() {
  return ({ provider }: ProviderSetupSectionProps) => (
    <section mix={[setupTopicStyle, stackSmStyle]}>
      <div mix={setupProviderHeaderStyle}>
        <div mix={stackSmStyle}>
          <h3 mix={setupHeadingStyle}>{getProviderSetupHeading(provider.name)}</h3>
        </div>
        <span
          mix={
            provider.configured
              ? [
                  setupStatusStyle,
                  css({
                    background: 'rgba(15, 159, 110, 0.12)',
                    color: 'var(--success)',
                  }),
                ]
              : setupStatusStyle
          }
        >
          {provider.configured ? 'Enabled' : 'Needs .env'}
        </span>
      </div>

      <p mix={mutedTextStyle}>
        <ProviderSetupDescription name={provider.name} />
      </p>

      <dl mix={setupDefinitionListStyle}>
        <div>
          <dt mix={setupDefinitionTermStyle}>Environment variables</dt>
          <dd mix={setupDefinitionDescriptionStyle}>
            {getProviderEnvVars(provider.name).map(name => (
              <code>{name}</code>
            ))}
          </dd>
        </div>
        <div>
          <dt mix={setupDefinitionTermStyle}>Callback URL</dt>
          <dd mix={setupDefinitionDescriptionStyle}>
            <code>{getProviderCallbackHref(provider.name, localDemoOrigin)}</code>
          </dd>
        </div>
        {provider.name === 'github' ? (
          <div>
            <dt mix={setupDefinitionTermStyle}>Homepage URL</dt>
            <dd mix={setupDefinitionDescriptionStyle}>
              <code>{localDemoOrigin}/</code>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

interface ProviderSetupDescriptionProps {
  name: SocialProviderName
}

function ProviderSetupDescription() {
  return ({ name }: ProviderSetupDescriptionProps) => {
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
            , add <code>{getProviderCallbackHref('google', localDemoOrigin)}</code> as an
            authorized redirect URI, then copy the client ID and client secret into .env.
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
            <code>{getProviderCallbackHref('github', localDemoOrigin)}</code> as the authorization
            callback URL, then copy the client ID and client secret into .env.
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
            , register <code>{getProviderCallbackHref('x', localDemoOrigin)}</code> as the
            callback URL, then copy the client ID and client secret into .env. Open the demo at{' '}
            <code>{localDemoOrigin}/</code> when you test the X flow.
          </>
        )
    }
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

let stackLgStyle = css({
  display: 'grid',
  gap: '18px',
})

let stackMdStyle = css({
  display: 'grid',
  gap: '14px',
})

let stackSmStyle = css({
  display: 'grid',
  gap: '6px',
})

let sectionTitleStyle = css({
  margin: 0,
  lineHeight: 1.04,
})

let mutedTextStyle = css({
  margin: 0,
  lineHeight: 1.58,
  '& a': {
    color: 'inherit',
    fontWeight: 700,
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '0.18em',
  },
  '& a:hover': {
    opacity: 0.78,
  },
})

let noticeStyle = css({
  borderRadius: 'var(--radius-lg)',
  padding: '12px 14px',
  border: '1px solid var(--error-border)',
  maxWidth: '760px',
  width: '100%',
})

let panelStyle = css({
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  borderRadius: 'var(--radius-xl)',
})

let authCardStyle = css({
  width: 'min(980px, 100%)',
  padding: 0,
  boxShadow: '0 26px 52px rgba(15, 23, 42, 0.12)',
  overflow: 'hidden',
})

let authSplitStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(280px, 0.84fr)',
  alignItems: 'stretch',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

let eyebrowStyle = css({
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: '0.74rem',
  fontWeight: 700,
  color: 'var(--muted)',
})

let credentialsPaneStyle = css({
  padding: '28px',
  background: 'rgba(255, 255, 255, 0.98)',
  '@media (max-width: 980px)': {
    padding: '22px',
  },
  '@media (max-width: 640px)': {
    padding: '18px 18px',
  },
})

let socialPaneStyle = css({
  padding: '28px',
  display: 'grid',
  alignContent: 'start',
  background:
    'radial-gradient(circle at top right, rgba(7, 168, 109, 0.1), transparent 34%), radial-gradient(circle at bottom left, rgba(7, 168, 109, 0.08), transparent 30%), #edf4f2',
  '@media (max-width: 980px)': {
    padding: '22px',
  },
  '@media (max-width: 640px)': {
    padding: '18px 18px',
  },
})

let authDividerStyle = css({
  display: 'grid',
  placeItems: 'center',
  padding: '0 8px',
  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.06))',
  '@media (max-width: 980px)': {
    display: 'none',
  },
})

let authDividerBubbleStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: '38px',
  height: '38px',
  borderRadius: '999px',
  background: '#ffffff',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  color: 'var(--muted)',
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
})

let credentialsFormStyle = css({
  display: 'grid',
  gap: '14px',
})

let formGridStyle = css({
  display: 'grid',
  gap: '12px',
})

let fieldStyle = css({
  display: 'grid',
  gap: '6px',
})

let fieldLabelStyle = css({
  fontSize: '0.84rem',
  fontWeight: 700,
  color: 'var(--text)',
})

let fieldInputStyle = css({
  width: '100%',
  border: '1px solid rgba(15, 23, 42, 0.1)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.9rem 0.95rem',
  font: 'inherit',
  color: 'var(--text)',
  background: '#ffffff',
  transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
  '&:focus': {
    outline: 'none',
    borderColor: 'rgba(37, 99, 235, 0.46)',
    boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.12)',
  },
})

let buttonBaseDeclarations = {
  display: 'grid',
  alignItems: 'center',
  width: '100%',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 32px rgba(15, 23, 42, 0.12)',
  },
}

let primaryButtonStyle = css({
  ...buttonBaseDeclarations,
  justifyContent: 'center',
  gridTemplateColumns: '1fr',
  padding: '9px 12px',
  color: '#ffffff',
  font: 'inherit',
  fontSize: '0.94rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, var(--primary), var(--primary-accent))',
})

let logoutButtonStyle = css({
  ...buttonBaseDeclarations,
  justifyContent: 'center',
  gridTemplateColumns: '1fr',
  maxWidth: '220px',
  margin: '0 28px 28px',
  padding: '9px 12px',
  color: '#ffffff',
  font: 'inherit',
  fontSize: '0.94rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #0f172a, #334155)',
  '@media (max-width: 640px)': {
    margin: '0 18px 18px',
  },
})

let demoAccountStyle = css({
  border: '1px solid var(--border)',
  background: '#f8fbff',
  borderRadius: 'var(--radius-xl)',
  padding: '14px 16px',
})

let demoAccountLabelStyle = css({
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: '0.74rem',
  fontWeight: 700,
  color: 'var(--muted)',
})

let providerListStyle = css({
  display: 'grid',
  gap: '12px',
  width: '100%',
})

let providerButtonStyle = css({
  ...buttonBaseDeclarations,
  gridTemplateColumns: 'auto 1fr',
  gap: '10px',
  padding: '7px 10px',
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.62,
    transform: 'none',
    boxShadow: 'none',
  },
})

let providerThemeStyles = {
  google: css({
    background: '#ffffff',
    color: '#1f2937',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  }),
  github: css({
    background: 'var(--github)',
    color: '#1f2937',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  }),
  x: css({
    background: 'linear-gradient(135deg, #2a2a2a, var(--x))',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
  }),
} as const

let providerMarkStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-md)',
  background: 'rgba(255, 255, 255, 0.18)',
  flexShrink: 0,
})

let providerMarkThemeStyles = {
  google: css({
    background: '#f4f7fb',
    boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.04)',
  }),
  github: css({
    background: 'rgba(255, 255, 255, 0.78)',
    boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.06)',
  }),
  x: css({}),
} as const

let providerIconStyle = css({
  display: 'block',
  width: '15px',
  height: '15px',
})

let providerIconInvertedStyle = css({
  filter: 'brightness(0) invert(1)',
})

let providerBodyStyle = css({
  display: 'grid',
  gap: 0,
  textAlign: 'left',
})

let providerTitleStyle = css({
  fontSize: '0.94rem',
  fontWeight: 700,
  lineHeight: 1.15,
})

let setupCardStyle = css({
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  borderRadius: 'var(--radius-xl)',
  padding: '18px',
})

let setupGuideCardStyle = css({
  width: '100%',
  background: 'rgba(244, 249, 248, 0.94)',
  boxShadow: '0 22px 48px rgba(15, 23, 42, 0.1)',
})

let setupTopicStyle = css({
  paddingTop: '12px',
  borderTop: '1px solid rgba(148, 163, 184, 0.22)',
})

let setupHeadingStyle = css({
  margin: 0,
  lineHeight: 1.2,
})

let setupSubheadingStyle = css({
  margin: 0,
  lineHeight: 1.2,
  fontSize: '1rem',
})

let setupColumnsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '16px',
  alignItems: 'start',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

let setupListStyle = css({
  margin: 0,
  paddingLeft: '18px',
  display: 'grid',
  gap: '8px',
  lineHeight: 1.55,
})

let setupProviderHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
})

let setupStatusStyle = css({
  borderRadius: '999px',
  padding: '0.36rem 0.72rem',
  background: 'rgba(148, 163, 184, 0.18)',
  color: '#475569',
  fontSize: '0.76rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
})

let setupDefinitionListStyle = css({
  margin: 0,
  display: 'grid',
  gap: '14px',
})

let setupDefinitionTermStyle = css({
  marginBottom: '6px',
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted)',
})

let setupDefinitionDescriptionStyle = css({
  margin: 0,
  display: 'grid',
  gap: '8px',
  lineHeight: 1.55,
  '& code': {
    width: '100%',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
})

let identityRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '20px',
  alignItems: 'center',
  padding: '0 28px',
  '@media (max-width: 640px)': {
    paddingLeft: '18px',
    paddingRight: '18px',
    gridTemplateColumns: '1fr',
  },
})

let profileDumpSectionStyle = css({
  padding: '0 28px',
  '@media (max-width: 640px)': {
    paddingLeft: '18px',
    paddingRight: '18px',
  },
})

let profileDumpStyle = css({
  margin: 0,
  padding: '14px 16px',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  borderRadius: 'var(--radius-lg)',
  background: 'rgba(248, 250, 252, 0.96)',
  color: 'var(--text)',
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontSize: '0.9rem',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
})

let avatarStyle = css({
  width: '88px',
  height: '88px',
  borderRadius: 'var(--radius-xl)',
  objectFit: 'cover',
  background: '#d7deea',
  '@media (max-width: 640px)': {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
  },
})

let avatarFallbackStyle = css({
  display: 'grid',
  placeItems: 'center',
  fontSize: '1.15rem',
  fontWeight: 800,
  color: '#ffffff',
  background: 'linear-gradient(135deg, #475569, #0f172a)',
})
