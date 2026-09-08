import type { Handle } from 'remix/ui'

import * as styles from '../../ui/styles.ts'

export function Footer(handle: Handle<{ prefix: string; href: string; label: string }>) {
  return () => (
    <p mix={styles.footerText}>
      {handle.props.prefix}{' '}
      <a href={handle.props.href} mix={styles.helperLink}>
        {handle.props.label}
      </a>
    </p>
  )
}
