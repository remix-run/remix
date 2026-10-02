import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { AuthCard } from './auth-card.tsx'
import { Document } from './document.tsx'
import { UserIcon } from './icons.tsx'
import { Notice } from './notice.tsx'
import { PasskeyOriginHint } from './passkey-origin-hint.tsx'
import { formatProviderLabel } from './provider-presentation.tsx'
import { PasskeyRegistration } from './public/passkey-registration.tsx'

import { designSystem } from './design-system.ts'

import * as styles from './styles.ts'
import type { AuthIdentity } from '../utils/auth-session.ts'
import type { PasskeySupport } from '../utils/passkey-auth.ts'

const { tokens } = designSystem

export interface PasskeySummary {
  id: string
  name: string
  backedUp: boolean
  createdAt: number
  lastUsedAt: number | null
  renameAction: string
  removeAction: string
}

export type PasskeyRegistrationSettings = PasskeySupport & {
  optionsAction: string
  createAction: string
}

interface AccountPageProps {
  identity: AuthIdentity
  logoutAction: string
  passkeys: PasskeySummary[]
  passkeyRegistration: PasskeyRegistrationSettings
  error?: string
  success?: string
}

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

export function AccountPage(handle: Handle<AccountPageProps>) {
  return () => {
    let { identity, logoutAction, passkeys, passkeyRegistration, error, success } = handle.props
    let displayName =
      identity.user.name ??
      identity.authAccount?.display_name ??
      identity.authAccount?.username ??
      identity.user.email ??
      'Authenticated User'
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
          {error ? <Notice tone="error">{error}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}

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
              This page shows the local user record together with any linked provider account data
              saved in SQLite.
            </p>
          </div>

          <pre mix={styles.dataDump}>{JSON.stringify(authDetails, null, 2)}</pre>

          <section aria-labelledby="passkeys-heading">
            <h2 id="passkeys-heading" mix={styles.sectionHeading}>
              Passkeys
            </h2>

            {passkeys.length === 0 ? (
              <p mix={[styles.passkeyItemMeta, css({ marginBottom: tokens.space.lg })]}>
                Add a passkey to sign in with your fingerprint, face, screen lock, or security key.
              </p>
            ) : (
              <ul mix={styles.passkeyList}>
                {passkeys.map((passkey) => (
                  <li key={passkey.id} mix={styles.passkeyItem}>
                    <span mix={styles.passkeyItemName}>{passkey.name}</span>
                    <span mix={styles.passkeyItemMeta}>{describePasskey(passkey)}</span>
                    <div mix={styles.inlineForm}>
                      <form
                        method="POST"
                        action={passkey.renameAction}
                        mix={[styles.inlineForm, css({ flex: '1', minWidth: 0 })]}
                      >
                        <input
                          name="name"
                          type="text"
                          defaultValue={passkey.name}
                          maxLength={64}
                          required
                          aria-label={`New name for ${passkey.name}`}
                          mix={styles.plainInput}
                        />
                        <button type="submit" mix={styles.smallButton}>
                          Rename
                        </button>
                      </form>
                      <form method="POST" action={passkey.removeAction}>
                        <button
                          type="submit"
                          aria-label={`Remove ${passkey.name}`}
                          mix={[styles.smallButton, styles.dangerButton]}
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {passkeyRegistration.available ? (
              <PasskeyRegistration
                optionsAction={passkeyRegistration.optionsAction}
                createAction={passkeyRegistration.createAction}
              />
            ) : (
              <PasskeyOriginHint href={passkeyRegistration.passkeyHref} action="add a passkey" />
            )}
          </section>

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

function describePasskey(passkey: PasskeySummary): string {
  let storage = passkey.backedUp ? 'Synced' : 'Stored on one device'
  let lastUsed =
    passkey.lastUsedAt == null ? 'Never used' : `Last used ${dateFormat.format(passkey.lastUsedAt)}`

  return `${storage} · Added ${dateFormat.format(passkey.createdAt)} · ${lastUsed}`
}
