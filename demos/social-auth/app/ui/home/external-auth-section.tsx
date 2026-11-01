import type { Handle } from 'remix/component'

import { Divider } from '../divider.tsx'
import { formatProviderLabel, renderProviderIcon } from '../provider-presentation.tsx'
import * as styles from '../styles.ts'
import { SocialProviderButton } from './social-provider-button.tsx'
import type { ExternalProviderLink } from '../../utils/external-auth.ts'

export function ExternalAuthSection(handle: Handle<{ providers: ExternalProviderLink[] }>) {
  return () => (
    <>
      <Divider label="or continue with" />

      <div mix={styles.socialButtons}>
        {handle.props.providers.map((provider) => (
          <SocialProviderButton
            key={provider.name}
            label={formatProviderLabel(provider.name)}
            href={provider.href}
            disabledReason={provider.disabledReason}
            icon={renderProviderIcon(provider.name)}
          />
        ))}
      </div>
    </>
  )
}
