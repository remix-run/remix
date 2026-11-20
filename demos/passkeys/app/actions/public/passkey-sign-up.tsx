import { createPasskey, isWebAuthnSupported } from 'remix/auth/webauthn-client'
import type { WebAuthnRegistrationOptionsJSON } from 'remix/auth/webauthn-client'
import { clientEntry, navigate, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import * as styles from '../../ui/public/styles.ts'
import { getPasskeyErrorMessage, postPasskeyRequest } from '../../utils/public/passkey-requests.ts'

export const PasskeySignUp = clientEntry(import.meta.url, function PasskeySignUp(handle: Handle) {
  // Unknown until the component runs in the browser, so the server renders a disabled button.
  let supported: boolean | undefined
  let pending = false
  let error: string | undefined

  handle.queueTask(() => {
    supported = isWebAuthnSupported()
    handle.update()
  })

  return () => (
    <form
      mix={[
        styles.form,
        on('submit', async (event, signal) => {
          event.preventDefault()
          let formData = new FormData(event.currentTarget)
          pending = true
          error = undefined
          handle.update()

          try {
            let options = await postPasskeyRequest<WebAuthnRegistrationOptionsJSON>(
              routes.auth.signupOptions.href(),
              formData,
              signal,
            )
            let credential = await createPasskey(options, { signal })
            let { redirectTo } = await postPasskeyRequest<{ redirectTo: string }>(
              routes.auth.signup.href(),
              credential,
              signal,
            )
            await navigate(redirectTo, { history: 'replace' })
          } catch (caught) {
            if (signal.aborted) return
            pending = false
            error = getPasskeyErrorMessage(caught)
            handle.update()
          }
        }),
      ]}
    >
      <div mix={styles.field}>
        <label for={`${handle.id}-username`} mix={styles.label}>
          Username
        </label>
        <input
          id={`${handle.id}-username`}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={32}
          aria-describedby={`${handle.id}-hint`}
          mix={styles.input}
        />
        <p id={`${handle.id}-hint`} mix={styles.muted}>
          Lowercase letters, numbers, hyphens, and underscores.
        </p>
      </div>

      {error ? (
        <p role="alert" mix={styles.errorMessage}>
          {error}
        </p>
      ) : null}
      {supported === false ? (
        <p role="alert" mix={styles.errorMessage}>
          This browser does not support passkeys.
        </p>
      ) : null}

      <button type="submit" disabled={supported !== true || pending} mix={styles.primaryButton}>
        {pending ? 'Creating your passkey…' : 'Create account with a passkey'}
      </button>
    </form>
  )
})
