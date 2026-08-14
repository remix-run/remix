import type { RemixNode } from './jsx.ts'

type SPAResponseData = {
  node: RemixNode
  redirectedTo?: string
}

let spaResponses: WeakMap<Response, SPAResponseData> | undefined

/**
 * Creates a bodyless response associated with a renderable Remix node.
 *
 * @param node Node to render when the response resolves a frame.
 * @param init Standard response status, status text, and headers.
 * @returns A response that can be read with {@link nodeFromSpaResponse}.
 * @throws {TypeError} When called outside a browser environment.
 */
export function spaResponse(node: RemixNode, init?: ResponseInit): Response {
  if (typeof document === 'undefined') {
    throw new TypeError('spaResponse() can only be used in a browser')
  }

  let response = new Response(null, init)
  let responses = (spaResponses ??= new WeakMap())
  responses.set(response, { node })
  return response
}

/**
 * Reads the Remix node associated with a response created by {@link spaResponse}.
 *
 * @param response Response to read.
 * @returns The associated Remix node.
 * @throws {TypeError} When the response was not created by {@link spaResponse}.
 */
export function nodeFromSpaResponse(response: Response): RemixNode {
  let data = spaResponses?.get(response)
  if (!data) throw new TypeError('Expected a Remix SPA response')
  return data.node
}

/**
 * Associates the final redirect URL with an SPA response for frame history updates.
 *
 * @param response Response to associate with a redirect URL.
 * @param redirectedTo Final redirect URL.
 * @throws {TypeError} When the response was not created by {@link spaResponse}.
 */
export function setSpaResponseRedirect(response: Response, redirectedTo: string): void {
  let data = spaResponses?.get(response)
  if (!data) throw new TypeError('Expected a Remix SPA response')
  data.redirectedTo = redirectedTo
}

export function getSpaResponseRedirect(response: Response): string | undefined {
  return spaResponses?.get(response)?.redirectedTo
}

export function isSpaResponse(response: Response): boolean {
  return spaResponses?.has(response) ?? false
}
