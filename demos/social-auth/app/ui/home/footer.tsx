import type { Handle } from 'remix/component'

import * as styles from '../styles.ts'

export function LoginFooter(handle: Handle<{ signupHref: string }>) {
  return () => (
    <p mix={styles.footerText}>
      Don't have an account?{' '}
      <a href={handle.props.signupHref} mix={styles.helperLink}>
        Sign up
      </a>
    </p>
  )
}
