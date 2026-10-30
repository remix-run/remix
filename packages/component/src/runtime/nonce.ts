import { DOCUMENT_NONCE_META_NAME } from './stream-protocol.ts'
import type { RuntimeHostProps, VNodeParent } from './vnode.ts'

export type ResourceNonces = Set<string>
type NonceManager = ReturnType<typeof createNonceManager>

const state: { manager: NonceManager | undefined } = {
  manager: undefined,
}

const DOCUMENT_NONCE_META_SELECTOR = `meta[name="${DOCUMENT_NONCE_META_NAME}"]`

export function getNonceManager(reportOnlyCsp = false): NonceManager {
  return (state.manager ??= createNonceManager(document, reportOnlyCsp))
}

// For tests that simulate independent document loads in the same browser realm.
export function resetNonceManager(): void {
  state.manager = undefined
}

function createNonceManager(doc: Document, reportOnlyCsp: boolean) {
  let nonceMeta = doc.head?.querySelector<HTMLMetaElement>(DOCUMENT_NONCE_META_SELECTOR)
  // Capture once, including an absent nonce; incoming metadata cannot establish a new one.
  let documentNonce = nonceMeta?.nonce
  let moduleNonce =
    doc.head?.querySelector<HTMLScriptElement>('script[data-rmx-import-map][type="importmap"]')
      ?.nonce ?? documentNonce
  let rootNonces = new WeakMap<object, ResourceNonces>()

  function prepareResponse(source: ParentNode, responseNonce?: string): void {
    for (let meta of source.querySelectorAll(DOCUMENT_NONCE_META_SELECTOR)) {
      if (meta !== nonceMeta) meta.remove()
    }

    if (responseNonce && documentNonce && responseNonce !== documentNonce) {
      // The selected CSP response header identifies the nonce; incoming metadata cannot.
      for (let element of source.querySelectorAll('style[nonce],script[nonce],link[nonce]')) {
        // Firefox clones the attribute rather than the nonce property in inert fragments.
        if ('nonce' in element && element.nonce === responseNonce) {
          element.setAttribute('nonce', documentNonce)
        }
      }
    }

    for (let template of source.querySelectorAll('template')) {
      prepareResponse(template.content, responseNonce)
    }
  }

  function addRootResponseNonce(root: object, responseNonce: string | undefined): void {
    if (!responseNonce || !documentNonce || responseNonce === documentNonce) return
    let nonces = rootNonces.get(root)
    if (!nonces) {
      nonces = new Set()
      rootNonces.set(root, nonces)
    }
    // Preserved component setup closures can still reference an earlier response nonce.
    nonces.add(responseNonce)
  }

  function getResourceNonces(parent: VNodeParent): ResourceNonces | undefined {
    while (parent.kind !== 'root') parent = parent._parent
    return parent._resourceNonces
  }

  function addRootResourceNonces(root: object, nonces: ResourceNonces | undefined): void {
    if (!nonces) return
    for (let nonce of nonces) addRootResponseNonce(root, nonce)
  }

  return {
    get reportOnlyCsp() {
      return reportOnlyCsp
    },
    get moduleNonce() {
      return moduleNonce
    },
    prepareResponse,
    shouldPreserveHeadNode(node: Node): boolean {
      return node.isConnected && node === nonceMeta
    },
    getRootResourceNonces(root: object): ResourceNonces | undefined {
      return rootNonces.get(root)
    },
    addRootResponseNonce,
    addRootResourceNonces,
    inheritRootResourceNonces(root: object, parent: VNodeParent): void {
      addRootResourceNonces(root, getResourceNonces(parent))
    },
    resolveResourceNonce(
      type: string,
      props: RuntimeHostProps,
      parent: VNodeParent,
    ): RuntimeHostProps {
      if (type !== 'style' && type !== 'script' && type !== 'link') return props
      if (typeof props.nonce !== 'string') return props
      if (!documentNonce || !getResourceNonces(parent)?.has(props.nonce)) return props
      return { ...props, nonce: documentNonce }
    },
    getResourceNonces,
  }
}

export function getResponseNonce(response: Response, reportOnlyCsp = false): string | undefined {
  let header = response.headers.get('Content-Security-Policy')
  if (header === null && reportOnlyCsp) {
    header = response.headers.get('Content-Security-Policy-Report-Only')
  }
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
