import { createPasskey, isWebAuthnSupported } from 'remix/auth/webauthn-client'
import type { WebAuthnRegistrationOptionsJSON } from 'remix/auth/webauthn-client'
import { clientEntry, navigate, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../routes.ts'
import * as styles from '../../../ui/public/styles.ts'
import {
  getPasskeyErrorMessage,
  postPasskeyRequest,
} from '../../../utils/public/passkey-requests.ts'

export const AddPasskey = clientEntry(import.meta.url, function AddPasskey(handle: Handle) {
  // Unknown until the component runs in the browser, so the server renders a disabled button.
  let supported: boolean | undefined
  let pending = false
  let error: string | undefined

  handle.queueTask(() => {
    supported = isWebAuthnSupported()
    handle.update()
  })

  return () => (
    <div mix={styles.form}>
      {error ? (
        <p role="alert" mix={styles.errorMessage}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={supported !== true || pending}
        mix={[
          styles.primaryButton,
          on('click', async (_event, signal) => {
            pending = true
            error = undefined
            handle.update()

            try {
              let options = await postPasskeyRequest<WebAuthnRegistrationOptionsJSON>(
                routes.account.passkeyOptions.href(),
                undefined,
                signal,
              )
              let credential = await createPasskey(options, { signal })
              let { redirectTo } = await postPasskeyRequest<{ redirectTo: string }>(
                routes.account.addPasskey.href(),
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
        {pending ? 'Adding passkey…' : 'Add a passkey'}
      </button>
    </div>
  )
})
