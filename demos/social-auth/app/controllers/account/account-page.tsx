import { css } from 'remix/component'

import { AuthCard } from '../ui/auth-card.tsx'
import { Document } from '../ui/document.tsx'
import { UserIcon } from '../ui/icons.tsx'
import { formatProviderLabel } from '../ui/provider-presentation.tsx'

import { designSystem } from '../ui/design-system.ts'

import * as styles from '../ui/styles.ts'
import type { AuthIdentity } from '../../utils/auth-session.ts'

let { tokens } = designSystem

export interface AccountPageProps {
  identity: AuthIdentity
  logoutAction: string
}

export function AccountPage() {
  return ({ identity, logoutAction }: AccountPageProps) => {
    let displayName =
      identity.user.name
      ?? identity.authAccount?.display_name
      ?? identity.authAccount?.username
      ?? identity.user.email
      ?? 'Authenticated User'
    let avatarUrl = identity.user.avatar_url ?? identity.authAccount?.avatar_url ?? null
    let providerLabel = formatProviderLabel(identity.loginMethod)
    let authDetails = {
      loginMethod: identity.loginMethod,
      user: identity.user,
      authAccount: identity.authAccount,
      providerProfile: identity.providerProfile,
    }

    return (
      <Document title="Your Account">
        <AuthCard title="Signed In" subtitle={`Authenticated with ${providerLabel}`}>
          <div mix={styles.profileHeader}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} mix={styles.profileAvatar} />
            ) : (
              <div mix={styles.profileFallbackAvatar}>
                <UserIcon mix={css({ width: '2rem', height: '2rem' })} />
              </div>
            )}

            <div>
              <p mix={styles.profileName}>{displayName}</p>
              <p mix={styles.profileMeta}>{identity.user.email ?? 'No email on file'}</p>
              <p mix={styles.profileMeta}>Provider: {providerLabel}</p>
            </div>
          </div>

          <div mix={styles.infoPanel}>
            <p>
              This page shows the local user record together with any linked provider account data saved
              in SQLite.
            </p>
          </div>

          <pre mix={styles.dataDump}>{JSON.stringify(authDetails, null, 2)}</pre>

          <form method="POST" action={logoutAction} mix={css({ marginTop: tokens.space.lg })}>
            <button type="submit" mix={styles.submitButton}>
              Logout
            </button>
          </form>
        </AuthCard>
      </Document>
    )
  }
}
