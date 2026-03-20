import { css } from 'remix/component'

import { designSystem } from '../design-system.ts'
import type { ExternalProviderName } from '../integrations/external-auth-providers.ts'
import { formatProviderLabel, renderProviderIcon } from '../ui/provider-presentation.tsx'
import * as styles from '../styles.ts'
import { SocialProviderButton } from './social-provider-button.tsx'

let { theme } = designSystem

export interface ProviderLink {
  name: ExternalProviderName
  href?: string
  disabledReason?: string
}

export function ExternalAuthSection() {
  return ({ providers }: { providers: ProviderLink[] }) => (
    <>
      <div mix={styles.divider}>
        <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
        <span mix={styles.dividerText}>or continue with</span>
        <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
      </div>

      <div mix={styles.socialButtons}>
        {providers.map(provider => (
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
