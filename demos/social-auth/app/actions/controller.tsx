import type { PasskeyAuthProvider } from 'remix/auth'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { passkeys } from '../data/schema.ts'
import { getReturnToHrefOptions, requireAuth } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import { AccountPage } from '../ui/account-page.tsx'
import { LoginPage } from '../ui/home/page.tsx'
import { assets } from '../utils/assets.ts'
import {
  externalProviderRegistry,
  readExternalProviderLinks,
  type ExternalProviderRegistry,
} from '../utils/external-auth.ts'
import { getPasskeySupport, passkeyProvider, toPasskeyCredential } from '../utils/passkey-auth.ts'

export function createRootController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
  provider: PasskeyAuthProvider = passkeyProvider,
) {
  return createController(routes, {
    actions: {
      async assets({ request }) {
        return (await assets.fetch(request)) ?? new Response('Not Found', { status: 404 })
      },

      home({ auth, render, session, url }) {
        if (auth.ok) {
          return redirect(routes.account.href())
        }

        let error = session.get('error')
        let success = session.get('success')
        let returnToHrefOptions = getReturnToHrefOptions(url)

        return render(
          <LoginPage
            formAction={routes.auth.login.href(undefined, returnToHrefOptions)}
            signupHref={routes.auth.signup.index.href(undefined, returnToHrefOptions)}
            forgotPasswordHref={routes.auth.forgotPassword.index.href(
              undefined,
              returnToHrefOptions,
            )}
            providers={readExternalProviderLinks(returnToHrefOptions, registry)}
            passkey={{
              ...getPasskeySupport(url, provider),
              optionsAction: routes.auth.passkey.options.href(),
              loginAction: routes.auth.passkey.login.href(undefined, returnToHrefOptions),
            }}
            error={typeof error === 'string' ? error : undefined}
            success={typeof success === 'string' ? success : undefined}
          />,
        )
      },

      account: {
        middleware: [requireAuth()],
        async handler({ auth, db, render, session, url }) {
          if (!auth.ok) {
            return new Response('Unauthorized', { status: 401 })
          }

          let error = session.get('error')
          let success = session.get('success')
          let userPasskeys = await db.findMany(passkeys, {
            where: { user_id: auth.identity.user.id },
            orderBy: ['created_at', 'asc'],
          })

          return render(
            <AccountPage
              identity={auth.identity}
              logoutAction={routes.auth.logout.href()}
              passkeys={userPasskeys.map((passkey) => ({
                id: passkey.id,
                name: passkey.name,
                backedUp: toPasskeyCredential(passkey).backedUp,
                createdAt: passkey.created_at,
                lastUsedAt: passkey.last_used_at ?? null,
                renameAction: routes.passkeys.rename.href({ passkeyId: passkey.id }),
                removeAction: routes.passkeys.remove.href({ passkeyId: passkey.id }),
              }))}
              passkeyRegistration={{
                ...getPasskeySupport(url, provider),
                optionsAction: routes.passkeys.registrationOptions.href(),
                createAction: routes.passkeys.create.href(),
              }}
              error={typeof error === 'string' ? error : undefined}
              success={typeof success === 'string' ? success : undefined}
            />,
          )
        },
      },
    },
  })
}
