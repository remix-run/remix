import type {
  CreateCookieFunction,
  CreateCookieSessionStorageFunction,
  CreateSessionStorageFunction,
  CreateMemorySessionStorageFunction,
  ServerBuild,
} from "@remix-run/server-runtime";

interface BaseContext {
  next: (options?: { sendConditionalRequest?: boolean }) => Promise<Response>;
}
export declare function createRequestHandler<
  Context extends BaseContext = BaseContext
>({
  build,
  mode,
  getLoadContext,
}: {
  build: ServerBuild;
  mode?: string;
  getLoadContext?: (
    request: Request,
    context?: Context
  ) => Promise<Context> | Context;
}): (request: Request, context: Context) => Promise<Response | void>;
export {};

export * from "@remix-run/server-runtime";

export const createCookie: CreateCookieFunction;
export const createCookieSessionStorage: CreateCookieSessionStorageFunction;
export const createSessionStorage: CreateSessionStorageFunction;
export const createMemorySessionStorage: CreateMemorySessionStorageFunction;
