import type { Handle } from 'remix/component'

import { Divider } from '../divider.tsx'
import * as styles from '../styles.ts'

interface EmailSignInSectionProps {
  magicLinkHref: string
  emailCodeHref: string
}

export function EmailSignInSection(handle: Handle<EmailSignInSectionProps>) {
  return () => (
    <>
      <Divider label="or sign in without a password" />

      <div mix={styles.socialButtons}>
        <a href={handle.props.magicLinkHref} mix={styles.secondaryButton}>
          Email Me a Sign-In Link
        </a>
        <a href={handle.props.emailCodeHref} mix={styles.secondaryButton}>
          Email Me a Code
        </a>
      </div>
    </>
  )
}
