import { getPasskey, isPasskeyAutofillSupported, isPasskeySupported } from 'remix/auth/browser'
import type { PasskeyRequestOptionsJSON } from 'remix/auth/browser'
import { clientEntry, on, ref, type Handle } from 'remix/component'

import * as styles from '../styles.ts'

interface PasskeySignInProps {
  optionsAction: string
  loginAction: string
}

interface AutofillRequest {
  controller: AbortController
  done: Promise<boolean>
}

export const PasskeySignIn = clientEntry(
  import.meta.url,
  function PasskeySignIn(handle: Handle<PasskeySignInProps>) {
    let supported = false
    let pending = false
    let message: string | null = null
    let form: HTMLFormElement | null = null
    let responseInput: HTMLInputElement | null = null
    let autofill: AutofillRequest | null = null

    handle.queueTask(async () => {
      supported = isPasskeySupported()
      message = supported ? null : 'This browser does not support passkeys.'
      await handle.update()

      if (supported && (await isPasskeyAutofillSupported())) {
        startAutofill()
      }
    })

    handle.signal.addEventListener('abort', () => autofill?.controller.abort())

    // Autofill keeps a passkey request open in the background, so the email field can offer
    // passkeys. It has to be aborted before the button starts a modal request.
    function startAutofill() {
      let controller = new AbortController()
      autofill = { controller, done: signIn({ autofill: true, signal: controller.signal }) }
    }

    async function stopAutofill() {
      if (autofill == null) return

      autofill.controller.abort()
      await autofill.done
      autofill = null
    }

    async function restartAutofill() {
      await stopAutofill()
      startAutofill()
    }

    // Resolves to `true` once the signed response is submitted for verification.
    async function signIn(options: { autofill: boolean; signal?: AbortSignal }): Promise<boolean> {
      let requestOptions = await fetchRequestOptions(options.signal)
      if (options.signal?.aborted) return false

      if (requestOptions == null) {
        message = 'We could not start passkey sign-in. Please try again.'
        await handle.update()
        return false
      }

      // Browsers keep autofill requests open indefinitely, but the server challenge expires after
      // `timeout`, so swap in a fresh request shortly before that happens.
      let refreshTimer = options.autofill
        ? setTimeout(restartAutofill, requestOptions.timeout * 0.9)
        : undefined
      let result = await getPasskey(requestOptions, options)
      clearTimeout(refreshTimer)
      if (options.signal?.aborted) return false

      if (!result.ok) {
        message = result.error.code === 'cancelled' ? null : result.error.message
        await handle.update()
        return false
      }

      responseInput!.value = JSON.stringify(result.response)
      form!.requestSubmit()
      return true
    }

    async function fetchRequestOptions(
      signal: AbortSignal | undefined,
    ): Promise<PasskeyRequestOptionsJSON | null> {
      try {
        let response = await fetch(handle.props.optionsAction, { method: 'POST', signal })
        return response.ok ? ((await response.json()) as PasskeyRequestOptionsJSON) : null
      } catch {
        return null
      }
    }

    return () => (
      <form
        method="POST"
        action={handle.props.loginAction}
        mix={[styles.passkeySignIn, ref((node) => (form = node))]}
      >
        <input type="hidden" name="response" mix={ref((node) => (responseInput = node))} />
        <button
          type="button"
          disabled={!supported || pending}
          mix={[
            styles.secondaryButton,
            styles.disabledButton,
            on('click', async () => {
              pending = true
              message = null
              await handle.update()
              await stopAutofill()
              if (await signIn({ autofill: false })) return

              pending = false
              await handle.update()

              if (await isPasskeyAutofillSupported()) {
                startAutofill()
              }
            }),
          ]}
        >
          {pending ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
        </button>
        {message ? (
          <p role="alert" mix={styles.passkeyMessage}>
            {message}
          </p>
        ) : null}
      </form>
    )
  },
)
