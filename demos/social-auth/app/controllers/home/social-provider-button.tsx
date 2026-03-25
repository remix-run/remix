import type { RemixNode } from 'remix/component'

import * as styles from '../../ui/styles.ts'

interface SocialProviderButtonProps {
  label: string
  icon: RemixNode
  href?: string
  disabledReason?: string
}

export function SocialProviderButton() {
  return ({ label, icon, href, disabledReason }: SocialProviderButtonProps) => {
    if (href) {
      return (
        <a href={href} mix={styles.socialButton}>
          {icon}
          <span mix={styles.socialButtonLabel}>{label}</span>
        </a>
      )
    }

    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={disabledReason}
        mix={[styles.socialButton, styles.socialButtonDisabled]}
      >
        {icon}
        <span mix={styles.socialButtonLabel}>{label}</span>
      </button>
    )
  }
}
