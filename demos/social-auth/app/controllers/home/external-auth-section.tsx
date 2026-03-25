import { css } from 'remix/component'

import { designSystem } from '../../ui/design-system.ts'
import { formatProviderLabel, renderProviderIcon } from '../../ui/provider-presentation.tsx'
import * as styles from '../../ui/styles.ts'
import { SocialProviderButton } from './social-provider-button.tsx'
import type { ExternalProviderLink } from '../../utils/external-auth.ts'

const { theme } = designSystem

export function ExternalAuthSection() {
  return ({ providers }: { providers: ExternalProviderLink[] }) => (
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
    </>
  )
}
