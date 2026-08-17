import type { RemixNode } from './jsx.ts'

type SPAResponseData = {
  node: RemixNode
  redirectedTo?: string
}

let spaResponses: WeakMap<Response, SPAResponseData> | undefined

/**
 * Creates and finalizes responses carrying renderable Remix nodes for the SPA runtime.
 */
export const spaResponse = {
  /**
   * Creates a bodyless response associated with a renderable Remix node.
   *
   * @param node Node to render when the response resolves a frame.
   * @param init Standard response status, status text, and headers.
   * @returns A response understood by the SPA runtime.
   * @throws {TypeError} When called outside a browser environment.
   */
  create(node: RemixNode, init?: ResponseInit): Response {
    if (typeof document === 'undefined') {
      throw new TypeError('spaResponse.create() can only be used in a browser')
    }

    let response = new Response(null, init)
    let responses = (spaResponses ??= new WeakMap())
    responses.set(response, { node })
    return response
  },

  /**
   * Prepares the final route response for frame resolution.
   *
   * @param response Final response returned by the SPA router.
   * @param redirectedTo Final redirect URL, when the route followed redirects.
   * @returns The same response after validating it and recording its redirect URL.
   * @throws {TypeError} When the response was not created by `spaResponse.create()`.
   */
  finalize(response: Response, redirectedTo?: string): Response {
    let data = getSpaResponseData(response)
    if (!data) throw new TypeError('Expected a Remix SPA response')

    if (redirectedTo === undefined) {
      delete data.redirectedTo
    } else {
      data.redirectedTo = redirectedTo
    }
    return response
  },
}

export function getSpaResponseData(response: Response): SPAResponseData | undefined {
  return spaResponses?.get(response)
}
