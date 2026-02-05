import { AsyncLocalStorage } from 'node:async_hooks'

import type { Middleware } from '@remix-run/fetch-router'

import type {
  AuthClient,
  AuthMethod,
  RestoredContext,
  User,
  inferAuthType,
  inferAuthorizeArgs,
  inferCallbackArgs,
  inferMethodContext,
  inferProfile,
} from './auth-client.ts'

const storage = new AsyncLocalStorage<AuthClient<any>>()

export const STOARGE_KEY = 'user'

export function createAuth<Methods extends AuthMethod<string, any, any, any, any>[]>(
  methods: Methods,
) {
  let methodsByType = new Map(methods.map((method) => [method.type, method]))

  let load: Middleware = async ({ session }, next) => {
    let promises: Record<string, Promise<any> | undefined> = {}
    let cache =
      <F extends (...otherKeys: string[]) => Promise<any>>(k: string, f: F) =>
      (...otherKeys: string[]) => {
        let key = k + otherKeys.join('--')
        if (promises[key]) return promises[key]
        return (promises[key] = f(...otherKeys)) as ReturnType<F>
      }

    let userSession = (session.get(STOARGE_KEY) ?? null) as User<any> | null

    let methodContext = cache('context', async (type, userId) => {
      return methodsByType.get(type)?.restore(userId)
    })

    let requestContext: RestoredContext<inferAuthType<Methods>> | null = userSession
      ? await methodContext(userSession.type, userSession.id)
      : null

    let user: User<any> | null =
      requestContext?.userId && userSession?.id && requestContext.userId === userSession.id
        ? userSession
        : null

    if (!user && userSession) {
      session.unset(STOARGE_KEY)
    }

    let profile = cache('profile', async () => {
      if (!user) return null
      let method = methodsByType.get(user.type)
      if (!method) return null

      return method.profile(user.id, await methodContext(user.type, user.id))
    })

    let authorize = async <T extends inferAuthType<Methods>>(
      type: T,
      args: inferAuthorizeArgs<T, Methods>,
    ) => {
      let method = methodsByType.get(type)
      if (!method) return null

      return method.authorize(args, await methodContext(type))
    }

    let callback = async <T extends inferAuthType<Methods>>(
      type: T,
      args: inferCallbackArgs<T, Methods>,
    ) => {
      let method = methodsByType.get(type)
      if (!method) return null

      let newUser = (await method.callback(args, methodContext(type))) as User<T> | null

      if (newUser) {
        user = newUser
        session.set(STOARGE_KEY, newUser)
      }

      return newUser
    }

    let logout = () => {
      user = null
      session.unset(STOARGE_KEY)
    }

    return storage.run(
      {
        get user() {
          return user
        },
        profile,
        authorize,
        callback,
        logout,
        methodContext: async (): Promise<null | inferMethodContext<Methods>> => {
          return user ? methodContext(user.type, user.id) : null
        },
      },
      next,
    )
  }

  let required: Middleware = (_, next) => {
    return next()
  }

  function getUser(required?: true): User<inferAuthType<Methods>>
  function getUser(required: false): User<inferAuthType<Methods>> | null
  function getUser(required: boolean = true) {
    let user = requireAuthClient().user
    if (required && user == null) throw new Error('User not found')
    return user
  }

  function getProfile(required?: true): Promise<inferProfile<Methods>>
  function getProfile(required: false): Promise<inferProfile<Methods> | null>
  async function getProfile(required: boolean = true): Promise<inferProfile<Methods> | null> {
    let profile = await requireAuthClient().profile()
    if (required && profile == null) throw new Error('Profile not found')
    return profile
  }

  async function authorize<T extends inferAuthType<Methods>>(
    type: T,
    args: inferAuthorizeArgs<T, Methods>,
  ): Promise<null | URL> {
    return requireAuthClient().authorize(type, args)
  }

  async function callback<T extends inferAuthType<Methods>>(
    type: T,
    args: inferCallbackArgs<T, Methods>,
  ): Promise<null | User<T>> {
    return requireAuthClient().callback(type, args)
  }

  function logout() {
    requireAuthClient().logout()
  }

  return {
    authorize,
    callback,
    getUser,
    getProfile,
    load,
    logout,
    required,
  }
}

export function requireAuthClient(): AuthClient<any> {
  let client = storage.getStore()
  if (client == null) {
    throw new Error('No auth context found. Make sure createAuth().middleware is installed.')
  }
  return client
}
