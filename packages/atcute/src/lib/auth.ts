import { Client } from '@atcute/client'
import type { AppBskyActorGetProfile } from '@atcute/bluesky'
import type { ActorIdentifier, Did } from '@atcute/lexicons'
import type { OAuthClient, OAuthSession } from '@atcute/oauth-node-client'
import {
  requireAuthClient,
  type AuthMethod,
  type RestoredContext,
} from '@remix-run/auth-middleware'

const TYPE = 'atcute'

type AtProfile = {
  type: typeof TYPE
  did: string
  bsky: AppBskyActorGetProfile.$output | null
}

type AtContext = RestoredContext<typeof TYPE> & {
  client: Client | null
  oauth: OAuthClient
  session: OAuthSession | null
}

export function atCuteAuthMethod(
  oauth: OAuthClient,
): AuthMethod<typeof TYPE, AtProfile, ActorIdentifier, URLSearchParams, AtContext> {
  return {
    type: TYPE,
    async restore(userId) {
      let session = await oauth.restore(userId as Did).catch(() => null)

      return {
        type: TYPE,
        userId: session ? session.did : undefined,
        client: session ? new Client({ handler: session }) : null,
        oauth,
        session,
      }
    },
    async authorize(handle, { oauth }) {
      let result = await oauth
        .authorize({
          target: {
            type: 'account',
            identifier: handle,
          },
        })
        .catch(() => null)

      return result?.url ?? null
    },
    async callback(searchParams) {
      let result = await oauth.callback(searchParams).catch(() => null)

      return result
        ? {
            type: TYPE,
            id: result.session.did,
          }
        : null
    },
    async profile(userId, { client }) {
      let bskyProfileResponse = await client
        ?.get('app.bsky.actor.getProfile', {
          params: { actor: userId as Did },
        })
        .catch(() => null)

      return {
        type: TYPE,
        did: userId,
        bsky: bskyProfileResponse?.ok ? bskyProfileResponse.data : null,
      }
    },
  }
}

export async function requireAtcute() {
  let client = requireAuthClient()
  let context = await client.methodContext()
  if (context?.type === TYPE) {
    let { client } = context as AtContext
    if (client) return client
  }
  throw new Error('No atcute client available')
}
