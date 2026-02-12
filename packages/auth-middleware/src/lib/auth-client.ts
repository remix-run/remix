export type User<T extends string> = {
  type: T
  id: string
}

export type Profile<T extends string> = {
  type: T
}

export type inferAuthType<Methods extends AuthMethod<string, any, any, any, any>[]> =
  Methods[number]['type']

export type inferAuthorizeArgs<
  T extends string,
  Methods extends AuthMethod<string, any, any, any, any>[],
> = Parameters<Extract<Methods[number], { type: T }>['authorize']>[0]

export type inferCallbackArgs<
  T extends string,
  Methods extends AuthMethod<string, any, any, any, any>[],
> = Parameters<Extract<Methods[number], { type: T }>['callback']>[0]

export type inferProfile<Methods extends AuthMethod<string, any, any, any, any>[]> = NonNullable<
  Awaited<ReturnType<Methods[number]['profile']>>
>

export type inferMethodContext<Methods extends AuthMethod<string, any, any, any, any>[]> =
  NonNullable<Awaited<ReturnType<Methods[number]['restore']>>>

export type RestoredContext<T extends string> = {
  type: T
  userId?: string
}

export interface AuthMethod<
  T extends string,
  P extends Profile<T>,
  AA,
  CA,
  C extends RestoredContext<T>,
> {
  type: T
  profile: (userId: string, context: C) => P | Promise<P>
  restore: (userId: string | undefined, request: Request) => C | Promise<C>
  authorize: (args: AA, context: C) => null | URL | Promise<null | URL>
  callback: (args: CA, context: C) => null | User<T> | Promise<null | User<T>>
}

export interface AuthClient<Methods extends AuthMethod<string, any, any, any, any>[]> {
  user: null | User<inferAuthType<Methods>>
  profile(): Promise<inferProfile<Methods> | null>
  authorize<T extends inferAuthType<Methods>>(
    type: T,
    args: inferAuthorizeArgs<T, Methods>,
  ): Promise<null | URL>
  callback<T extends inferAuthType<Methods>>(
    type: T,
    args: inferCallbackArgs<T, Methods>,
  ): Promise<null | User<T>>
  logout(): void
  methodContext(): Promise<null | RestoredContext<inferAuthType<Methods>>>
}
