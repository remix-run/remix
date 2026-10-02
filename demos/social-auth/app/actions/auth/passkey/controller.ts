import { completeAuth, finishPasskeyAuthentication, startPasskeyAuthentication } from 'remix/auth'
import type { PasskeyAuthProvider } from 'remix/auth'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { passkeys } from '../../../data/schema.ts'
import { getPostAuthRedirect, getReturnToHrefOptions } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { getPasskeyErrorMessage, passkeyProvider } from '../../../utils/passkey-auth.ts'

export function createPasskeyAuthController(provider: PasskeyAuthProvider = passkeyProvider) {
  return createController(routes.auth.passkey, {
    actions: {
      async options(context) {
        return Response.json(await startPasskeyAuthentication(provider, context))
      },

      async login(context) {
        let { db, formData, session, url } = context
        let result = await finishPasskeyAuthentication(provider, context, {
          response: formData.get('response'),
        })

        if (!result.ok) {
          session.flash('error', getPasskeyErrorMessage(result.error))
          return redirect(routes.home.href(undefined, getReturnToHrefOptions(url)))
        }

        let { credential } = result
        await db.update(passkeys, credential.id, {
          counter: credential.counter,
          backed_up: credential.backedUp,
          last_used_at: Date.now(),
        })

        let authSession = completeAuth(context)
        authSession.set('auth', {
          userId: Number(credential.userId),
          loginMethod: 'passkey',
        })

        return redirect(getPostAuthRedirect(url))
      },
    },
  })
}
