import { css } from 'remix/component'

import { designSystem } from '../../ui/design-system.ts'
import { TextField } from '../../ui/form-field.tsx'
import { AtmosphereIcon } from '../../ui/icons.tsx'
import { formatProviderLabel, renderProviderIcon } from '../../ui/provider-presentation.tsx'
import * as styles from '../../ui/styles.ts'
import { SocialProviderButton } from './social-provider-button.tsx'
import type { ExternalProviderLink } from '../../utils/external-auth.ts'

const { theme } = designSystem

const atmospherePanel = css({
  marginTop: '1rem',
  padding: '1rem',
  borderRadius: '0.75rem',
  border: theme.border.subtle,
  backgroundColor: theme.surface.subtleHover,
})

const atmosphereCopy = css({
  marginBottom: '0.75rem',
  color: theme.text.body,
  fontSize: '0.875rem',
})

export function ExternalAuthSection() {
  return ({
    providers,
    atmosphereLoginHref,
    returnTo,
  }: {
    providers: ExternalProviderLink[]
    atmosphereLoginHref: string
    returnTo?: string
  }) => (
    <>
      <div mix={styles.divider}>
        <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
        <span mix={styles.dividerText}>or continue with</span>
        <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
      </div>

      <div mix={styles.socialButtons}>
        {providers.map((provider) => (
          <SocialProviderButton
            key={provider.name}
            label={formatProviderLabel(provider.name)}
            href={provider.href}
            disabledReason={provider.disabledReason}
            icon={renderProviderIcon(provider.name)}
          />
        ))}
      </div>

      <div mix={atmospherePanel}>
        <p mix={atmosphereCopy}>
          Continue with a Bluesky handle or DID. The demo uses the localhost loopback OAuth
          flow, so no extra provider secrets are required.
        </p>

        <form method="GET" action={atmosphereLoginHref} mix={styles.form}>
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

          <TextField
            id="atmosphere-handle-or-did"
            name="handleOrDid"
            type="text"
            label="Bluesky handle or DID"
            placeholder="alice.bsky.social or did:plc:..."
            autoComplete="username"
            required
            icon={<AtmosphereIcon mix={styles.fieldIcon} />}
          />

          <button type="submit" mix={styles.secondaryButton}>
            Continue with {formatProviderLabel('atmosphere')}
          </button>
        </form>
      </div>
    </>
  )
}
