import type { RemixNode } from 'remix/component'

import * as styles from './styles.ts'
import type { ExternalProviderName } from '../../utils/external-auth.ts'
import type { AuthMethod } from '../../utils/auth-session.ts'
import { GitHubIcon, GoogleIcon, XIcon } from './icons.tsx'

export function renderProviderIcon(provider: ExternalProviderName): RemixNode {
  switch (provider) {
    case 'google':
      return <GoogleIcon mix={styles.socialIcon} />
    case 'github':
      return <GitHubIcon mix={styles.socialIcon} />
    case 'x':
      return <XIcon mix={styles.socialIcon} />
    default:
      throw new Error('Unknown provider')
  }
}

export function formatProviderLabel(provider: AuthMethod): string {
  switch (provider) {
    case 'credentials':
      return 'Credentials'
    case 'google':
      return 'Google'
    case 'github':
      return 'GitHub'
    case 'x':
      return 'X'
    default:
      throw new Error('Unknown provider')
  }
}
