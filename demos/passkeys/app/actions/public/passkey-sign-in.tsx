import { getPasskey, isWebAuthnSupported } from 'remix/auth/webauthn-client'
import type { WebAuthnAuthenticationOptionsJSON } from 'remix/auth/webauthn-client'
import { clientEntry, navigate, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import * as styles from '../../ui/public/styles.ts'
import { getPasskeyErrorMessage, postPasskeyRequest } from '../../utils/public/passkey-requests.ts'

export const PasskeySignIn = clientEntry(import.meta.url, function PasskeySignIn(handle: Handle) {
  // Unknown until the component runs in the browser, so the server renders a disabled button.
  let supported: boolean | undefined
  let autofillAvailable = false
  let autofill: AbortController | undefined
  let pending = false
  let error: string | undefined

  handle.queueTask(async () => {
    supported = isWebAuthnSupported()
    autofillAvailable =
      supported && (await PublicKeyCredential.isConditionalMediationAvailable?.()) === true
    handle.update()
    startAutofill()
  })

  // Offers the user's passkeys in the username field's autofill menu. The request stays pending
  // until the user picks a passkey there or it is aborted.
  function startAutofill() {
    if (!autofillAvailable || handle.signal.aborted) return
    autofill = new AbortController()
    signIn('conditional', AbortSignal.any([handle.signal, autofill.signal]))
  }

  async function signIn(
    mediation: CredentialMediationRequirement | undefined,
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      let options = await postPasskeyRequest<WebAuthnAuthenticationOptionsJSON>(
        routes.auth.loginOptions.href(),
        undefined,
        signal,
      )
      let credential = await getPasskey(options, { mediation, signal })
      pending = true
      error = undefined
      handle.update()

      let { redirectTo } = await postPasskeyRequest<{ redirectTo: string }>(
        routes.auth.login.href(),
        credential,
        signal,
      )
      await navigate(redirectTo, { history: 'replace' })
      return true
    } catch (caught) {
      if (signal.aborted) return false
      // An autofill request fails without the user doing anything when the browser can't offer
      // passkeys there. Stay quiet and point the user at the button instead.
      if (mediation === 'conditional' && !pending) {
        autofillAvailable = false
        handle.update()
        return false
      }
      pending = false
      error = getPasskeyErrorMessage(caught)
      handle.update()
      return false
    }
  }

  return () => (
    <form
      mix={[
        styles.form,
        on('submit', async (event, signal) => {
          event.preventDefault()
          // A page can only wait on one passkey request at a time, so the button's prompt
          // replaces the autofill request, which starts again if the prompt fails.
          autofill?.abort()
          if (!(await signIn(undefined, signal)) && !signal.aborted) {
            startAutofill()
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
          autoComplete="username webauthn"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={`${handle.id}-hint`}
          mix={styles.input}
        />
        <p id={`${handle.id}-hint`} mix={styles.muted}>
          {autofillAvailable
            ? 'Pick a saved passkey from this field, or use the button.'
            : 'Use the button to choose a saved passkey.'}
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
        {pending ? 'Signing in…' : 'Sign in with a passkey'}
      </button>
    </form>
  )
})
