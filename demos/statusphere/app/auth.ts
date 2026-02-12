import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver'
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node'
import { MemoryStore, OAuthClient, scope, type StoredState } from '@atcute/oauth-node-client'
import { atCuteAuthMethod } from '@remix-run/atcute'
import { createAuth } from '@remix-run/auth-middleware'

import { routes } from './routes.ts'

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44400
let TEN_MINUTES_MS = 10 * 60_000

let oauth = new OAuthClient({
  metadata: {
    redirect_uris: [`http://127.0.0.1:${port}${routes.oauth.atproto.href()}`],
    scope: [
      scope.rpc({ lxm: ['app.bsky.actor.getProfile'], aud: '*' }),
      scope.repo({
        collection: ['xyz.statusphere.status'],
        action: ['create', 'delete', 'update'],
      }),
    ],
  },
  actorResolver: new LocalActorResolver({
    handleResolver: new CompositeHandleResolver({
      methods: {
        dns: new NodeDnsHandleResolver(),
        http: new WellKnownHandleResolver(),
      },
    }),
    didDocumentResolver: new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver(),
        web: new WebDidDocumentResolver(),
      },
    }),
  }),
  stores: {
    sessions: new MemoryStore({ maxSize: 10 }),
    states: new MemoryStore<string, StoredState>({
      maxSize: 10,
      ttl: TEN_MINUTES_MS,
      ttlAutopurge: true,
    }),
  },
})

export let auth = createAuth([atCuteAuthMethod(oauth)])
