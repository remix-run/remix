import type { RemixNode } from 'remix/component'

import * as styles from '../styles.ts'
import type { ExternalProviderName, SocialAuthMethod } from '../social-auth.ts'
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

export function formatProviderLabel(provider: SocialAuthMethod): string {
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
