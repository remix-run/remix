import { finishPasskeyRegistration, startPasskeyRegistration } from 'remix/auth'
import type { PasskeyAuthProvider } from 'remix/auth'
import { maxLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import * as s from 'remix/data-schema'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { passkeys } from '../../data/schema.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import {
  getPasskeyErrorMessage,
  passkeyProvider,
  toPasskeyCredential,
} from '../../utils/passkey-auth.ts'

const passkeyNameSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(maxLength(64))),
})

export function createPasskeysController(provider: PasskeyAuthProvider = passkeyProvider) {
  return createController(routes.passkeys, {
    middleware: [requireAuth()],
    actions: {
      async registrationOptions(context) {
        let { auth, db } = context
        let { user } = auth.identity
        let existingPasskeys = await db.findMany(passkeys, { where: { user_id: user.id } })
        let accountName = user.email ?? `user-${user.id}`

        return Response.json(
          await startPasskeyRegistration(provider, context, {
            user: {
              id: String(user.id),
              name: accountName,
              displayName: user.name ?? accountName,
            },
            excludeCredentials: existingPasskeys.map(toPasskeyCredential),
          }),
        )
      },

      async create(context) {
        let { auth, db, formData, session } = context
        let { user } = auth.identity
        let name = readPasskeyName(formData)
        if (name == null) {
          session.flash('error', 'Passkey names must be 64 characters or fewer.')
          return redirect(routes.account.href())
        }

        let result = await finishPasskeyRegistration(provider, context, {
          response: formData.get('response'),
          userId: String(user.id),
        })

        if (!result.ok) {
          session.flash('error', getPasskeyErrorMessage(result.error))
          return redirect(routes.account.href())
        }

        let { credential } = result
        let passkeyName = name || 'Passkey'
        await db.create(passkeys, {
          id: credential.id,
          user_id: user.id,
          name: passkeyName,
          public_key: credential.publicKey,
          counter: credential.counter,
          transports: JSON.stringify(credential.transports ?? []),
          backup_eligible: credential.backupEligible,
          backed_up: credential.backedUp,
          aaguid: credential.aaguid,
          created_at: Date.now(),
        })

        session.flash('success', `Added passkey "${passkeyName}".`)
        return redirect(routes.account.href())
      },

      async rename({ auth, db, formData, params, session }) {
        let passkey = await db.findOne(passkeys, {
          where: { id: params.passkeyId, user_id: auth.identity.user.id },
        })
        let name = readPasskeyName(formData)

        if (passkey == null) {
          session.flash('error', 'That passkey no longer exists.')
        } else if (name == null || name === '') {
          session.flash('error', 'Passkey names must be 1 to 64 characters.')
        } else {
          await db.update(passkeys, passkey.id, { name })
          session.flash('success', `Renamed passkey to "${name}".`)
        }

        return redirect(routes.account.href())
      },

      async remove({ auth, db, params, session }) {
        let passkey = await db.findOne(passkeys, {
          where: { id: params.passkeyId, user_id: auth.identity.user.id },
        })

        if (passkey == null) {
          session.flash('error', 'That passkey no longer exists.')
        } else {
          await db.delete(passkeys, passkey.id)
          session.flash('success', `Removed passkey "${passkey.name}".`)
        }

        return redirect(routes.account.href())
      },
    },
  })
}

function readPasskeyName(formData: FormData): string | null {
  let result = s.parseSafe(passkeyNameSchema, formData)
  return result.success ? result.value.name.trim() : null
}
