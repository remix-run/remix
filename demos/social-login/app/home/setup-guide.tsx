import { css } from 'remix/component'

import {
  getProviderCallbackHref,
  getProviderEnvVars,
  getProviderSetupHeading,
  type SocialProviderName,
  type SocialProviderState,
} from '../social-providers.ts'
import {
  demoAccountLabelStyle,
  demoAccountStyle,
  eyebrowStyle,
  localDemoOrigin,
  mutedTextStyle,
  sectionTitleStyle,
  setupCardStyle,
  setupColumnsStyle,
  setupDefinitionDescriptionStyle,
  setupDefinitionListStyle,
  setupDefinitionTermStyle,
  setupGuideCardStyle,
  setupHeadingStyle,
  setupListStyle,
  setupProviderHeaderStyle,
  setupStatusStyle,
  setupSubheadingStyle,
  setupTopicStyle,
  stackLgStyle,
  stackMdStyle,
  stackSmStyle,
} from './styles.ts'

interface SetupGuideProps {
  providers: SocialProviderState[]
}

export function SetupGuide() {
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

        {providers.map(provider => (
          <ProviderSetupSection key={provider.name} provider={provider} />
        ))}
      </div>
    </section>
  )
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
