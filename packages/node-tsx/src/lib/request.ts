const SCOPED_PROTOCOL = 'remix-node-tsx://'
const NAMESPACE_QUERY_PARAMETER = 'remix-node-tsx-namespace'

interface ScopedRequest {
  namespace: string
  parentURL: string
  specifier: string
}

export function appendNamespaceToUrl(url: string, namespace: string): string {
  let parsedUrl = new URL(url)
  parsedUrl.searchParams.set(NAMESPACE_QUERY_PARAMETER, namespace)
  return parsedUrl.toString()
}

export function createScopedSpecifier(request: ScopedRequest): string {
  return `${SCOPED_PROTOCOL}${encodeURIComponent(JSON.stringify(request))}`
}

export function getNamespace(url: string | undefined): string | undefined {
  if (url == null || !url.includes(`${NAMESPACE_QUERY_PARAMETER}=`)) {
    return undefined
  }

  return new URL(url).searchParams.get(NAMESPACE_QUERY_PARAMETER) ?? undefined
}

export function parseScopedSpecifier(specifier: string): ScopedRequest | undefined {
  if (!specifier.startsWith(SCOPED_PROTOCOL)) {
    return undefined
  }

  return JSON.parse(decodeURIComponent(specifier.slice(SCOPED_PROTOCOL.length))) as ScopedRequest
}
