import {
  completeAuth,
  finishWebAuthnAuthentication,
  finishWebAuthnRegistration,
  startWebAuthnAuthentication,
  startWebAuthnRegistration,
} from 'remix/auth'
import type {
  FinishedWebAuthnAuthenticationResult,
  WebAuthnCredential,
  WebAuthnProvider,
} from 'remix/auth'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { passkeys, users } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { findPasskeyCredential, toPasskeyRow } from '../../utils/passkeys.ts'

const usernamePattern = /^[a-z0-9_-]{3,32}$/

const signupFormSchema = f.object({
  username: f.field(s.defaulted(s.string(), '')),
})

const pendingSignupSchema = s.object({
  userId: s.string(),
  username: s.string(),
})

export function createAuthController(passkeyProvider: WebAuthnProvider) {
  return createController(routes.auth, {
    actions: {
      async signupOptions(context) {
        let { db, formData, session } = context
        let username = s.parse(signupFormSchema, formData).username.trim().toLowerCase()

        if (!usernamePattern.test(username)) {
          return Response.json(
            { error: 'Use 3 to 32 lowercase letters, numbers, hyphens, or underscores.' },
            { status: 400 },
          )
        }
        if ((await db.findOne(users, { where: { username } })) != null) {
          return Response.json({ error: 'That username is taken.' }, { status: 409 })
        }

        // The account is created only once the browser returns a verified passkey, so remember
        // which user id this sign-up promised to the username until then.
        let userId = crypto.randomUUID()
        session.set('signup', { userId, username })

        return Response.json(
          startWebAuthnRegistration(passkeyProvider, context, {
            user: { id: userId, name: username },
          }),
        )
      },

      async signup(context) {
        let { db, session } = context
        let signup = s.parseSafe(pendingSignupSchema, session.get('signup'))
        session.unset('signup')
        if (!signup.success) {
          return Response.json(
            { error: 'Your sign-up expired. Please try again.' },
            { status: 400 },
          )
        }

        let { userId, username } = signup.value
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
          // Errors must not escape: the session middleware only saves the removed challenge when
          // the route returns a response.
          return Response.json(
            { error: 'We could not verify your passkey. Please try again.' },
            { status: 400 },
          )
        }

        // A newer sign-up in this session replaced the one this passkey was created for.
        if (credential.userId !== userId) {
          return Response.json(
            { error: 'Your sign-up expired. Please try again.' },
            { status: 400 },
          )
        }

        let createdAt = Date.now()
        let created = await db.transaction(async (tx) => {
          if ((await tx.findOne(users, { where: { username } })) != null) {
            return false
          }

          await tx.create(users, { id: userId, username, created_at: createdAt })
          await tx.create(passkeys, toPasskeyRow(credential, createdAt))
          return true
        })
        if (!created) {
          return Response.json({ error: 'That username is taken.' }, { status: 409 })
        }

        completeAuth(context).set('auth', { userId })
        return Response.json({ redirectTo: routes.account.index.href() })
      },

      loginOptions(context) {
        return Response.json(startWebAuthnAuthentication(passkeyProvider, context))
      },

      async login(context) {
        let { db } = context
        let result: FinishedWebAuthnAuthenticationResult
        try {
          result = await finishWebAuthnAuthentication(
            passkeyProvider,
            context,
            await context.request.json(),
            { getCredential: (id) => findPasskeyCredential(db, id) },
          )
        } catch {
          return Response.json(
            { error: 'We could not sign you in with that passkey.' },
            { status: 401 },
          )
        }

        // Save the new signature counter so a cloned authenticator is detected on a later login.
        await db.update(passkeys, result.credential.id, {
          sign_count: result.credential.signCount,
          backed_up: result.credential.backedUp,
          last_used_at: Date.now(),
        })

        completeAuth(context).set('auth', { userId: result.userId })
        return Response.json({ redirectTo: routes.account.index.href() })
      },

      logout({ session }) {
        session.unset('auth')
        session.regenerateId(true)
        return redirect(routes.home.href())
      },
    },
  })
}
