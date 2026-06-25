type RequestInitRequestKey = Extract<keyof RequestInit, keyof Request>
type LazyRequestFields = { url: Request['url'] } & Pick<RequestInit, RequestInitRequestKey>
type RequestInitFieldMap = {
  [key in RequestInitRequestKey]: RequestInit[key] | undefined
}

export function createRequest(input: URL | RequestInfo, init?: RequestInit): Request {
  if (typeof input === 'string' || input instanceof URL) {
    return new Request(input, init)
  }

  if (!(input instanceof Request)) {
    return new Request(input, init)
  }

  if (init == null) {
    return input
  }

  if (isNativeRequest(input)) {
    return new Request(input, init)
  }

  // Lazy requests from node-fetch-server inherit from Request.prototype but do not have native
  // Request private slots. This means `input instanceof Request` is true, but `new Request(input,
  // init)` throws when native Request accessors try to read from those missing private slots.
  let lazyRequest = input as LazyRequestFields
  // The use of this object with `satisfies` ensures we're mapping all RequestInit fields
  let requestInit = {
    method: lazyRequest.method,
    headers: lazyRequest.headers,
    body: lazyRequest.body,
    signal: lazyRequest.signal,
    cache: lazyRequest.cache,
    credentials: lazyRequest.credentials,
    integrity: lazyRequest.integrity,
    keepalive: lazyRequest.keepalive,
    mode: lazyRequest.mode,
    redirect: lazyRequest.redirect,
    referrer: lazyRequest.referrer,
    referrerPolicy: lazyRequest.referrerPolicy,
  } satisfies RequestInitFieldMap

  let finalRequestInit: RequestInit = {
    ...requestInit,
    ...init,
  }

  let method = finalRequestInit.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    // init.duplex = 'half' must be set when body is a ReadableStream, and Node follows the spec.
    // However, this property is not defined in the TypeScript types for RequestInit, so we have
    // to cast it here in order to set it without a type error.
    // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex
    ;(finalRequestInit as { duplex: 'half' }).duplex = 'half'
  }

  return new Request(lazyRequest.url, finalRequestInit)
}

function isNativeRequest(input: URL | RequestInfo): input is Request {
  if (!(input instanceof Request)) {
    return false
  }

  try {
    // `Request.prototype.method` is a getter, not a method we can call directly. Reflect.get lets
    // us read the getter with `input` as the receiver, similar to `input.method`. Lazy requests
    // from node-fetch-server inherit from Request.prototype, so `input instanceof Request` is true,
    // but native Request getters throw because lazy requests don't have the private Request state
    // that those getters read from.
    Reflect.get(Request.prototype, 'method', input)
    return true
  } catch {
    return false
  }
}
