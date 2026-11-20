import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { Passkey } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import * as styles from '../../ui/public/styles.ts'
import { AddPasskey } from './public/add-passkey.tsx'

interface AccountPageProps {
  username: string
  passkeys: Passkey[]
  error?: string
  success?: string
}

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const passkeyList = css({
  display: 'grid',
  gap: '0.75rem',
  listStyle: 'none',
})

const passkeyItem = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.875rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
})

export function AccountPage(handle: Handle<AccountPageProps>) {
  return () => {
    let { username, passkeys, error, success } = handle.props
    let canRemove = passkeys.length > 1

    return (
      <Document title="Your Account">
        <div mix={styles.stack}>
          <section aria-labelledby="account-heading" mix={styles.card}>
            <h1 id="account-heading" mix={styles.heading}>
              Signed in as {username}
            </h1>

            {error ? (
              <p role="alert" mix={styles.errorMessage}>
                {error}
              </p>
            ) : null}
            {success ? (
              <p role="status" mix={styles.successMessage}>
                {success}
              </p>
            ) : null}

            <h2 mix={styles.subheading}>Your passkeys</h2>
            <ul mix={passkeyList}>
              {passkeys.map((passkey) => (
                <li key={passkey.id} mix={passkeyItem}>
                  <div id={`passkey-${passkey.id}`}>
                    <p>
                      {passkey.backed_up
                        ? 'Synced passkey'
                        : passkey.backup_eligible
                          ? 'Passkey, not synced yet'
                          : 'Passkey on a single device'}
                    </p>
                    <p mix={styles.muted}>
                      Added{' '}
                      <time dateTime={new Date(passkey.created_at).toISOString()}>
                        {dateFormat.format(passkey.created_at)}
                      </time>
                      {passkey.last_used_at == null ? null : (
                        <>
                          {' · Last used '}
                          <time dateTime={new Date(passkey.last_used_at).toISOString()}>
                            {dateFormat.format(passkey.last_used_at)}
                          </time>
                        </>
                      )}
                    </p>
                  </div>

                  {canRemove ? (
                    <form
                      method="POST"
                      action={routes.account.removePasskey.href({ passkeyId: passkey.id })}
                    >
                      <input type="hidden" name="_method" value="DELETE" />
                      <button
                        type="submit"
                        aria-describedby={`passkey-${passkey.id}`}
                        mix={styles.secondaryButton}
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {canRemove ? null : (
              <p mix={styles.muted}>
                Add a passkey on another device so you can still sign in if you lose this one.
              </p>
            )}

            <AddPasskey />
          </section>

          <form method="POST" action={routes.auth.logout.href()}>
            <button type="submit" mix={styles.secondaryButton}>
              Sign out
            </button>
          </form>
        </div>
      </Document>
    )
  }
}
