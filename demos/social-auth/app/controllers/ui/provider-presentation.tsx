import type { RemixNode } from 'remix/component'

import type { AuthMethod } from '../../utils/auth-session.ts'
import type { ExternalProviderName } from '../../utils/external-auth.ts'
import { getExternalProviderLabel } from '../../utils/external-auth.ts'
import { GitHubIcon, GoogleIcon, XIcon } from './icons.tsx'
import * as styles from './styles.ts'

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
  if (provider === 'credentials') {
    return 'Credentials'
  }

  return getExternalProviderLabel(provider)
}
