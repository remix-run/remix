import { STATUS_CODES } from 'node:http'
import * as uWS from 'uWebSockets.js'

import type { ClientAddress, ErrorHandler, FetchHandler } from './fetch-handler.ts'
import { createUwsRequest, type UwsResponseState } from './uws-request.ts'

// "Internal Server Error"
const internalServerErrorBody = [
  73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111, 114,
]

/**
 * Options for `createUwsRequestHandler()`.
 */
export interface UwsRequestHandlerOptions {
  /**
   * Overrides the host portion of the incoming request URL. By default the request URL host is
   * derived from the HTTP `Host` header.
   */
  host?: string
  /**
   * Overrides the protocol of the incoming request URL. Defaults to `http:`.
   */
  protocol?: string
  /**
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
   */
  onError?: ErrorHandler
}

/**
 * A route handler returned by `createUwsRequestHandler()`.
 */
export interface UwsRequestHandler {
  (res: uWS.HttpResponse, req: uWS.HttpRequest): void
}

/**
 * TLS certificate options for an HTTPS server.
 */
export interface ServeTlsOptions {
  /**
   * The path to the private key file to use for TLS.
   */
  keyFile: string
  /**
   * The path to the certificate file to use for TLS.
   */
  certFile: string
  /**
   * The path to a CA certificate file to use for TLS.
   */
  caFile?: string
  /**
   * The passphrase to use when the private key is encrypted.
   */
  passphrase?: string
}

/**
 * Options for a server created with `serve()`.
 */
export interface ServeOptions {
  /**
   * Overrides the host portion of the incoming request URL. By default the request URL host is
   * derived from the HTTP `Host` header.
   */
  host?: string
  /**
   * Overrides the protocol of the incoming request URL. Defaults to `http:` or `https:` when `tls`
   * is provided.
   */
  protocol?: string
  /**
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
   */
  onError?: ErrorHandler
  /**
   * The hostname or IP address to listen on. By default the server listens on all interfaces.
   */
  listenHost?: string
  /**
   * The TCP port to listen on. Defaults to 3000.
   */
  port?: number
  /**
   * TLS options. When provided, the server accepts HTTPS requests and incoming request URLs default
   * to the `https:` protocol.
   */
  tls?: ServeTlsOptions
  /**
   * Configures the underlying uWebSockets.js app before the Fetch fallback route is registered and
   * before the server starts listening. Use this for low-level transport features such as native
   * WebSocket routes and connection filters.
   */
  setup?: (app: uWS.TemplatedApp) => void
}

/**
 * A running Node.js server created by `serve()`.
 */
export interface Server {
  /**
   * The underlying native server application for advanced transport-specific customization.
   */
  app: uWS.TemplatedApp
  /**
   * A promise that resolves when the server has started listening.
   */
  ready: Promise<void>
  /**
   * The active TCP port after `ready` resolves. This is useful when listening on port 0.
   */
  readonly port: number
  /**
   * Closes the listening socket and active connections.
   */
  close(): void
}

/**
 * Creates a route handler for an existing uWebSockets.js app from a Fetch API handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Request handler options
 * @returns A route handler that can be registered on a uWebSockets.js app
 */
export function createUwsRequestHandler(
  handler: FetchHandler,
  options?: UwsRequestHandlerOptions,
): UwsRequestHandler {
  let onError = options?.onError ?? defaultErrorHandler

  if (handler.length === 0) {
    let handlerWithoutArgs = handler as () => Response | Promise<Response>

    return (res, req) => {
      let state = createUwsResponseState(res)
      let method = req.getCaseSensitiveMethod()

      let response: Response | Promise<Response>
      try {
        response = handlerWithoutArgs()
      } catch (error) {
        void sendErrorResponse(res, state, method, onError, error)
        return
      }

      if (isPromiseLike(response)) {
        void response.then(
          (response) => {
            void sendUwsResponse(res, state, method, response)
          },
          (error) => {
            void sendErrorResponse(res, state, method, onError, error)
          },
        )
      } else {
        void sendUwsResponse(res, state, method, response)
      }
    }
  }

  if (handler.length === 1) {
    let requestHandler = handler as (request: Request) => Response | Promise<Response>

    return (res, req) => {
      let state = createUwsResponseState(res)
      let method = req.getCaseSensitiveMethod()
      let request = createUwsRequest(req, res, state, options, method)

      let response: Response | Promise<Response>
      try {
        response = requestHandler(request)
      } catch (error) {
        void sendErrorResponse(res, state, method, onError, error)
        return
      }

      if (isPromiseLike(response)) {
        void response.then(
          (response) => {
            void sendUwsResponse(res, state, method, response)
          },
          (error) => {
            void sendErrorResponse(res, state, method, onError, error)
          },
        )
      } else {
        void sendUwsResponse(res, state, method, response)
      }
    }
  }

  return (res, req) => {
    let state = createUwsResponseState(res)
    let method = req.getCaseSensitiveMethod()
    let request = createUwsRequest(req, res, state, options, method)
    let client = createClientAddress(res)

    let response: Response | Promise<Response>
    try {
      response = handler(request, client)
    } catch (error) {
      void sendErrorResponse(res, state, method, onError, error)
      return
    }

    if (isPromiseLike(response)) {
      void response.then(
        (response) => {
          void sendUwsResponse(res, state, method, response)
        },
        (error) => {
          void sendErrorResponse(res, state, method, onError, error)
        },
      )
    } else {
      void sendUwsResponse(res, state, method, response)
    }
  }
}

/**
 * Starts a server that sends incoming requests to a Fetch API handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Server options
 * @returns The running server
 */
export function serve(handler: FetchHandler, options?: ServeOptions): Server {
  let app = createApp(options?.tls)
  let listenSocket: uWS.us_listen_socket | false = false
  let port = 0

  try {
    options?.setup?.(app)
  } catch (error) {
    app.close()
    throw error
  }

  let ready = new Promise<void>((resolve, reject) => {
    let onListen = (socket: uWS.us_listen_socket | false) => {
      if (socket === false) {
        reject(new Error(`Unable to listen on port ${options?.port ?? 3000}`))
        return
      }

      listenSocket = socket
      port = uWS.us_socket_local_port(socket)
      resolve()
    }

    app.any('/*', createUwsRequestHandler(handler, createServeRequestHandlerOptions(options)))

    if (options?.listenHost != null) {
      app.listen(options.listenHost, options.port ?? 3000, onListen)
    } else {
      app.listen(options?.port ?? 3000, onListen)
    }
  })

  return {
    app,
    ready,
    get port() {
      return port
    },
    close() {
      if (listenSocket !== false) {
        uWS.us_listen_socket_close(listenSocket)
        listenSocket = false
      }
      app.close()
    },
  }
}

function createApp(tls: ServeTlsOptions | undefined): uWS.TemplatedApp {
  if (tls == null) return uWS.App()

  let options: uWS.AppOptions = {
    key_file_name: tls.keyFile,
    cert_file_name: tls.certFile,
  }

  if (tls.caFile != null) options.ca_file_name = tls.caFile
  if (tls.passphrase != null) options.passphrase = tls.passphrase

  return uWS.SSLApp(options)
}

function createServeRequestHandlerOptions(
  options: ServeOptions | undefined,
): UwsRequestHandlerOptions | undefined {
  if (options?.tls == null || options.protocol != null) return options
  return { ...options, protocol: 'https:' }
}

async function sendUwsResponse(
  res: uWS.HttpResponse,
  state: UwsResponseState,
  method: string,
  response: Response,
): Promise<void> {
  if (state.aborted) return

  if (method === 'HEAD' || response.body == null) {
    endUwsResponse(res, state, response, undefined)
    return
  }

  let reader = response.body.getReader()
  try {
    let first = await reader.read()
    if (state.aborted) return

    if (first.done) {
      endUwsResponse(res, state, response, undefined)
      return
    }

    let second = await reader.read()
    if (state.aborted) return

    if (second.done) {
      endUwsResponse(res, state, response, first.value)
      return
    }

    writeResponseStart(res, state, response)

    if (!writeChunk(res, state, first.value)) {
      await waitForWritable(res)
      if (state.aborted) return
    }

    if (!writeChunk(res, state, second.value)) {
      await waitForWritable(res)
      if (state.aborted) return
    }

    while (true) {
      let result = await reader.read()
      if (state.aborted) return
      if (result.done) break

      if (!writeChunk(res, state, result.value)) {
        await waitForWritable(res)
        if (state.aborted) return
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!state.aborted) res.end()
}

function writeResponseStart(
  res: uWS.HttpResponse,
  state: UwsResponseState,
  response: Response,
): void {
  if (state.aborted) return

  res.cork(() => {
    if (state.aborted) return

    writeStatus(res, response)
    for (let [key, value] of response.headers) {
      res.writeHeader(key, value)
    }
  })
}

function endUwsResponse(
  res: uWS.HttpResponse,
  state: UwsResponseState,
  response: Response,
  body?: Uint8Array,
): void {
  if (state.aborted) return

  res.cork(() => {
    if (state.aborted) return

    writeStatus(res, response)
    for (let [key, value] of response.headers) {
      res.writeHeader(key, value)
    }

    if (body == null) {
      res.endWithoutBody()
    } else {
      res.end(body)
    }
  })
}

function writeChunk(res: uWS.HttpResponse, state: UwsResponseState, chunk: Uint8Array): boolean {
  if (state.aborted) return true
  return res.write(chunk)
}

function waitForWritable(res: uWS.HttpResponse): Promise<void> {
  return new Promise((resolve) => {
    res.onWritable(() => {
      resolve()
      return true
    })
  })
}

async function sendErrorResponse(
  res: uWS.HttpResponse,
  state: UwsResponseState,
  method: string,
  onError: ErrorHandler,
  error: unknown,
): Promise<void> {
  let response = await createErrorResponse(onError, error)
  await sendUwsResponse(res, state, method, response)
}

async function createErrorResponse(onError: ErrorHandler, error: unknown): Promise<Response> {
  try {
    return (await onError(error)) ?? internalServerError()
  } catch (error) {
    console.error(`There was an error in the error handler: ${error}`)
    return internalServerError()
  }
}

function defaultErrorHandler(error: unknown): Response {
  console.error(error)
  return internalServerError()
}

function internalServerError(): Response {
  return new Response(new Uint8Array(internalServerErrorBody), {
    status: 500,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

function isPromiseLike<value>(value: value | PromiseLike<value>): value is PromiseLike<value> {
  return typeof (value as { then?: unknown }).then === 'function'
}

function createUwsResponseState(res: uWS.HttpResponse): UwsResponseState {
  let state: UwsResponseState = {
    aborted: false,
    abortBody: undefined,
    controller: undefined,
  }

  res.onAborted(() => {
    state.aborted = true
    state.controller?.abort()
    state.abortBody?.()
  })

  return state
}

function createClientAddress(res: uWS.HttpResponse): ClientAddress {
  let address = Buffer.from(res.getRemoteAddressAsText()).toString()

  return {
    address,
    family: address.includes(':') ? 'IPv6' : 'IPv4',
    port: res.getRemotePort(),
  }
}

function writeStatus(res: uWS.HttpResponse, response: Response): void {
  if (response.status !== 200 || response.statusText !== '') {
    res.writeStatus(createStatusLine(response))
  }
}

function createStatusLine(response: Response): string {
  let statusText = response.statusText || STATUS_CODES[response.status] || ''
  return statusText === '' ? String(response.status) : `${response.status} ${statusText}`
}
