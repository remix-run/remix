import type { FrameContent, FrameResolution } from './component.ts'
import { getSpaResponseData } from './spa-response.ts'

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
  let header = response.headers.get('Content-Security-Policy')
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
