import type { FrameContent, FrameResolution } from './component.ts'
import type { RemixNode } from './core/vnode.ts'

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

function getSpaResponseData(response: Response): SPAResponseData | undefined {
  return spaResponses?.get(response)
}

export async function unwrapFrameResolution(
  resolution: FrameResolution,
): Promise<{ content: FrameContent; redirectedTo?: string; nonce?: string }> {
  if (!(resolution instanceof Response)) return { content: resolution }

  let data = getSpaResponseData(resolution)
  if (data) {
    return {
      content: data.node,
      redirectedTo: data.redirectedTo,
    }
  }

  let content = resolution.body ?? (await resolution.text())
  return {
    content,
    nonce: getResponseNonce(resolution),
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
  }
}

function getResponseNonce(response: Response): string | undefined {
  let header =
    response.headers.get('Content-Security-Policy') ??
    response.headers.get('Content-Security-Policy-Report-Only')
  let nonce: string | undefined
  for (let policy of header?.split(',') ?? []) {
    let directives = new Map<string, string[]>()
    for (let directive of policy.split(';')) {
      let tokens = directive.split(/[\t\n\f\r ]+/).filter(Boolean)
      let name = tokens.shift()?.toLowerCase()
      // CSP uses the first occurrence, even when its source list is empty.
      if (name && !directives.has(name)) directives.set(name, tokens)
    }
    let scriptSources =
      directives.get('script-src-elem') ??
      directives.get('script-src') ??
      directives.get('default-src')
    let styleSources =
      directives.get('style-src-elem') ??
      directives.get('style-src') ??
      directives.get('default-src')
    for (let sources of [scriptSources, styleSources]) {
      for (let source of sources ?? []) {
        let value = /^'nonce-([a-z0-9+/_-]+={0,2})'$/i.exec(source)?.[1]
        if (value === undefined) continue
        // Only translate a single shared render nonce; differing values are ambiguous.
        if (nonce !== undefined && nonce !== value) return undefined
        nonce = value
      }
    }
  }
  return nonce
}
