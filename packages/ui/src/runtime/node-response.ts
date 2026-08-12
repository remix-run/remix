import type { RemixNode } from './jsx.ts'

type NodeResponseData = {
  node: RemixNode
  redirectedTo?: string
}

const nodeResponses = new WeakMap<Response, NodeResponseData>()

/**
 * Creates a bodyless response associated with a renderable Remix node.
 *
 * @param node Node to render when the response resolves a frame.
 * @param init Standard response status, status text, and headers.
 * @returns A response that can be read with {@link nodeFromResponse}.
 */
export function nodeResponse(node: RemixNode, init?: ResponseInit): Response {
  let response = new Response(null, init)
  nodeResponses.set(response, { node })
  return response
}

/**
 * Reads the Remix node associated with a response created by {@link nodeResponse}.
 *
 * @param response Response to read.
 * @returns The associated Remix node.
 * @throws {TypeError} When the response was not created by {@link nodeResponse}.
 */
export function nodeFromResponse(response: Response): RemixNode {
  let data = nodeResponses.get(response)
  if (!data) throw new TypeError('Expected a Remix node response')
  return data.node
}

export function setNodeResponseRedirect(response: Response, redirectedTo: string): void {
  let data = nodeResponses.get(response)
  if (!data) throw new TypeError('Expected a Remix node response')
  data.redirectedTo = redirectedTo
}

export function getNodeResponseRedirect(response: Response): string | undefined {
  return nodeResponses.get(response)?.redirectedTo
}

export function isNodeResponse(response: Response): boolean {
  return nodeResponses.has(response)
}
