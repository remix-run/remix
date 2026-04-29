import { STATUS_CODES } from 'node:http'
import * as uWS from 'uWebSockets.js'

import type { ClientAddress, ErrorHandler, FetchHandler } from './fetch-handler.ts'
import { createUwsRequest, type UwsRequestOptions, type UwsResponseState } from './uws-request.ts'

// "Internal Server Error"
const internalServerErrorBody = [
  73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111, 114,
]

export interface UwsRequestHandlerOptions extends UwsRequestOptions {
  /**
   * An error handler that determines the response when the request handler throws an error. By
   * default a 500 Internal Server Error response will be sent.
   */
  onError?: ErrorHandler
}

export interface UwsRequestHandler {
  (res: uWS.HttpResponse, req: uWS.HttpRequest): void
}

export interface ServeOptions extends UwsRequestHandlerOptions {
  /**
   * The hostname or IP address to listen on. By default uWebSockets.js listens on all interfaces.
   */
  listenHost?: string
  /**
   * The TCP port to listen on. Defaults to 3000.
   */
  port?: number
}

export interface Server {
  /**
   * The underlying uWebSockets.js application.
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
 * Wraps a fetch handler in a uWebSockets.js HTTP route handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Request handler options
 * @returns A uWebSockets.js route handler
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
 * Starts a uWebSockets.js server that sends incoming requests to a fetch handler.
 *
 * @param handler The fetch handler to use for processing incoming requests
 * @param options Server options
 * @returns The running uWebSockets.js server
 */
export function serve(handler: FetchHandler, options?: ServeOptions): Server {
  let app = uWS.App()
  let listenSocket: uWS.us_listen_socket | false = false
  let port = 0

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

    app.any('/*', createUwsRequestHandler(handler, options))

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

    res.writeStatus(createStatusLine(response))
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

    res.writeStatus(createStatusLine(response))
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

function createStatusLine(response: Response): string {
  let statusText = response.statusText || STATUS_CODES[response.status] || ''
  return statusText === '' ? String(response.status) : `${response.status} ${statusText}`
}
