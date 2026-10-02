import { createPasskey, isPasskeySupported } from 'remix/auth/browser'
import type { PasskeyCreationOptionsJSON } from 'remix/auth/browser'
import { clientEntry, on, ref, type Handle } from 'remix/component'

import * as styles from '../styles.ts'

interface PasskeyRegistrationProps {
  optionsAction: string
  createAction: string
}

export const PasskeyRegistration = clientEntry(
  import.meta.url,
  function PasskeyRegistration(handle: Handle<PasskeyRegistrationProps>) {
    let supported = false
    let pending = false
    let message: string | null = null
    let form: HTMLFormElement | null = null
    let responseInput: HTMLInputElement | null = null

    handle.queueTask(async () => {
      supported = isPasskeySupported()
      message = supported ? null : 'This browser does not support passkeys.'
      await handle.update()
    })

    // Returns `true` once the new passkey is submitted to the server for verification.
    async function addPasskey(): Promise<boolean> {
      let creationOptions = await fetchCreationOptions()
      if (creationOptions == null) {
        message = 'We could not start passkey registration. Please try again.'
        return false
      }

      let result = await createPasskey(creationOptions, { signal: handle.signal })
      if (!result.ok) {
        message =
          result.error.code === 'cancelled'
            ? 'Passkey creation was cancelled.'
            : result.error.code === 'excluded_credential'
              ? 'This device already has a passkey for your account.'
              : result.error.message
        return false
      }

      responseInput!.value = JSON.stringify(result.response)
      form!.submit()
      return true
    }

    async function fetchCreationOptions(): Promise<PasskeyCreationOptionsJSON | null> {
      try {
        let response = await fetch(handle.props.optionsAction, {
          method: 'POST',
          signal: handle.signal,
        })
        return response.ok ? ((await response.json()) as PasskeyCreationOptionsJSON) : null
      } catch {
        return null
      }
    }

    return () => (
      <form
        method="POST"
        action={handle.props.createAction}
        mix={[
          styles.form,
          ref((node) => (form = node)),
          on('submit', async (event) => {
            event.preventDefault()
            pending = true
            message = null
            await handle.update()

            if (await addPasskey()) return

            pending = false
            await handle.update()
          }),
        ]}
      >
        <div>
          <label htmlFor="passkey-name" mix={styles.fieldLabel}>
            Passkey name
          </label>
          <input
            id="passkey-name"
            name="name"
            type="text"
            maxLength={64}
            placeholder="For example, Work laptop"
            mix={[styles.plainInput, styles.fullWidth]}
          />
        </div>
        <input type="hidden" name="response" mix={ref((node) => (responseInput = node))} />
        <button
          type="submit"
          disabled={!supported || pending}
          mix={[styles.submitButton, styles.disabledButton]}
        >
          {pending ? 'Waiting for your device…' : 'Add a passkey'}
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
