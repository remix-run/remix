import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { getProviderIconHref, getProviderLoginHref, type SocialProviderState } from '../social-providers.ts'
import {
  authCardStyle,
  authDividerBubbleStyle,
  authDividerStyle,
  authSplitStyle,
  credentialsFormStyle,
  credentialsPaneStyle,
  demoAccountLabelStyle,
  demoAccountStyle,
  eyebrowStyle,
  fieldInputStyle,
  fieldLabelStyle,
  fieldStyle,
  formGridStyle,
  mutedTextStyle,
  panelStyle,
  primaryButtonStyle,
  providerBodyStyle,
  providerButtonStyle,
  providerIconInvertedStyle,
  providerIconStyle,
  providerListStyle,
  providerMarkStyle,
  providerMarkThemeStyles,
  providerThemeStyles,
  providerTitleStyle,
  sectionTitleStyle,
  socialPaneStyle,
  stackLgStyle,
  stackSmStyle,
} from './styles.ts'

interface SignedOutStateProps {
  providers: SocialProviderState[]
}

export function SignedOutState() {
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
          {providers.map(provider => (
            <ProviderButton key={provider.name} provider={provider} />
          ))}
        </div>
      </aside>
    </section>
  )
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
