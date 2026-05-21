import type { Handle, RemixNode } from 'remix/ui'

import * as styles from '../styles.ts'

interface SocialProviderButtonProps {
  label: string
  icon: RemixNode
  href?: string
  disabledReason?: string
}

export function SocialProviderButton(handle: Handle<SocialProviderButtonProps>) {
  return () => {
    let { label, icon, href, disabledReason } = handle.props

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
