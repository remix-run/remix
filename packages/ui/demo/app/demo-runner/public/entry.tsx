import type { FrameContent, ResolveFrameOptions } from 'remix/ui'
import { run } from 'remix/ui'

run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as Record<string, unknown>)[exportName]

    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }

    return exp
  },
  async resolveFrame(src, options) {
    return resolveFrameResponse(new URL(src, window.location.href), options)
  },
})

async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<FrameContent> {
  let headers = new Headers()
  headers.set('Accept', 'text/html')
  headers.set('X-Remix-Frame', 'true')

  if (options?.target) {
    headers.set('X-Remix-Target', options.target)
  }

  let response = await fetch(url, {
    headers,
    method: options?.method,
    body: options?.method?.toLowerCase() === 'get' ? undefined : options?.formData,
    signal: options?.signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`)
  }

  if (response.body) {
    return response.body
  }

  return await response.text()
}
