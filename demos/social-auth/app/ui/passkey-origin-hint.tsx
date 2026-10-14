import type { Handle } from 'remix/component'

import * as styles from './styles.ts'

interface PasskeyOriginHintProps {
  href: string
  action: string
}

export function PasskeyOriginHint(handle: Handle<PasskeyOriginHintProps>) {
  return () => {
    let { href, action } = handle.props
    let host = new URL(href).host

    return (
      <p mix={styles.passkeyHint}>
        Passkeys are tied to a domain name, and this demo serves them from {host}.{' '}
        <a href={href} mix={styles.helperLink}>
          Open this page on {host}
        </a>{' '}
        to {action}.
      </p>
    )
  }
}
