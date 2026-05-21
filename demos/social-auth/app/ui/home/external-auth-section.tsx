import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { designSystem } from '../design-system.ts'
import { formatProviderLabel, renderProviderIcon } from '../provider-presentation.tsx'
import * as styles from '../styles.ts'
import { SocialProviderButton } from './social-provider-button.tsx'
import type { ExternalProviderLink } from '../../utils/external-auth.ts'

const { theme } = designSystem

export function ExternalAuthSection(handle: Handle<{ providers: ExternalProviderLink[] }>) {
  return () => (
    <>
      <div mix={styles.divider}>
        <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
        <span mix={styles.dividerText}>or continue with</span>
        <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
      </div>

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
