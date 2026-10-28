import type { RuntimeHostProps, VNodeParent } from './vnode.ts'

export type ResourceNonces = {
  documentNonce: string
  responseNonces: Set<string>
}

const rootNonces = new WeakMap<object, ResourceNonces>()

export function getRootResourceNonces(root: object): ResourceNonces | undefined {
  return rootNonces.get(root)
}

export function addRootResponseNonce(
  root: object,
  responseNonce: string | undefined,
  documentNonce: string | undefined,
): void {
  if (!responseNonce || !documentNonce || responseNonce === documentNonce) return
  let nonces = rootNonces.get(root)
  if (!nonces) {
    nonces = { documentNonce, responseNonces: new Set() }
    rootNonces.set(root, nonces)
  }
  // Preserved component setup closures can still reference an earlier response nonce.
  nonces.responseNonces.add(responseNonce)
}

export function addRootResourceNonces(root: object, nonces: ResourceNonces | undefined): void {
  if (!nonces) return
  for (let nonce of nonces.responseNonces) {
    addRootResponseNonce(root, nonce, nonces.documentNonce)
  }
}

export function resolveResourceNonce(
  type: string,
  props: RuntimeHostProps,
  parent: VNodeParent,
): RuntimeHostProps {
  if (type !== 'style' && type !== 'script' && type !== 'link') return props
  if (typeof props.nonce !== 'string') return props
  let nonces = getResourceNonces(parent)
  if (!nonces?.responseNonces.has(props.nonce)) return props
  return { ...props, nonce: nonces.documentNonce }
}

export function getResourceNonces(parent: VNodeParent): ResourceNonces | undefined {
  while (parent.kind !== 'root') parent = parent._parent
  return parent._resourceNonces
}
