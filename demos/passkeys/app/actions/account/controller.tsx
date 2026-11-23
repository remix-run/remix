import { finishWebAuthnRegistration, startWebAuthnRegistration } from 'remix/auth'
import type { WebAuthnCredential, WebAuthnProvider } from 'remix/auth'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { passkeys } from '../../data/schema.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { findPasskeyCredential, toPasskeyRow, toWebAuthnCredential } from '../../utils/passkeys.ts'
import { AccountPage } from './account-page.tsx'

export function createAccountController(passkeyProvider: WebAuthnProvider) {
  return createController(routes.account, {
    middleware: [requireAuth()],
    actions: {
      async index({ auth, db, render, session }) {
        let user = auth.identity
        let userPasskeys = await db.findMany(passkeys, {
          where: { user_id: user.id },
          orderBy: ['created_at', 'asc'],
        })
        let error = session.get('error')
        let success = session.get('success')

        return render(
          <AccountPage
            username={user.username}
            passkeys={userPasskeys}
            error={typeof error === 'string' ? error : undefined}
            success={typeof success === 'string' ? success : undefined}
          />,
        )
      },

      async passkeyOptions(context) {
        let { auth, db } = context
        let userPasskeys = await db.findMany(passkeys, { where: { user_id: auth.identity.id } })

        return Response.json(
          startWebAuthnRegistration(passkeyProvider, context, {
            user: { id: auth.identity.id, name: auth.identity.username },
            // Stops an authenticator that already holds one of this user's passkeys from making
            // another.
            excludeCredentials: userPasskeys.map(toWebAuthnCredential),
          }),
        )
      },

      async addPasskey(context) {
        let { auth, db, session } = context
        let credential: WebAuthnCredential
        try {
          let result = await finishWebAuthnRegistration(
            passkeyProvider,
            context,
            await context.request.json(),
            { getCredential: (id) => findPasskeyCredential(db, id) },
          )
          credential = result.credential
        } catch {
          return Response.json(
            { error: 'We could not verify that passkey. Please try again.' },
            { status: 400 },
          )
        }

        // The ceremony belongs to whoever was signed in when it started.
        if (credential.userId !== auth.identity.id) {
          return Response.json(
            { error: 'You signed in as someone else. Please try again.' },
            { status: 400 },
          )
        }

        await db.create(passkeys, toPasskeyRow(credential, Date.now()))
        session.flash('success', 'Passkey added.')
        return Response.json({ redirectTo: routes.account.index.href() })
      },

      async removePasskey({ auth, db, params, session }) {
        let passkey = await db.findOne(passkeys, {
          where: { id: params.passkeyId, user_id: auth.identity.id },
        })
        if (passkey == null) {
          session.flash('error', 'That passkey was already removed.')
          return redirect(routes.account.index.href())
        }

        if ((await db.count(passkeys, { where: { user_id: auth.identity.id } })) === 1) {
          session.flash('error', 'Add another passkey before removing your last one.')
          return redirect(routes.account.index.href())
        }

        await db.delete(passkeys, passkey.id)
        session.flash('success', 'Passkey removed.')
        return redirect(routes.account.index.href())
      },
    },
  })
}
