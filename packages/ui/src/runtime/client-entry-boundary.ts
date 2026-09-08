import type { VirtualRoot } from './vdom.ts'

export type ClientEntryIdentity = {
  moduleUrl: string
  exportName: string
}

type ClientEntryRoot = Pick<VirtualRoot, 'dispose' | 'render'>

export type ClientEntryBoundaryOwner = {
  identity: ClientEntryIdentity
  root: ClientEntryRoot
}

const CLIENT_ENTRY_BOUNDARY_OWNER = Symbol('ClientEntryBoundaryOwner')

type ClientEntryBoundaryMarker = Comment & {
  [CLIENT_ENTRY_BOUNDARY_OWNER]?: ClientEntryBoundaryOwner
  $rmx?: ClientEntryRoot
}

export function getClientEntryBoundaryOwner(marker: Comment): ClientEntryBoundaryOwner | undefined {
  return (marker as ClientEntryBoundaryMarker)[CLIENT_ENTRY_BOUNDARY_OWNER]
}

export function setClientEntryBoundaryOwner(
  marker: Comment,
  identity: ClientEntryIdentity,
  root: ClientEntryRoot,
): ClientEntryBoundaryOwner {
  let owner = { identity, root }
  Object.defineProperties(marker, {
    [CLIENT_ENTRY_BOUNDARY_OWNER]: {
      configurable: true,
      value: owner,
    },
    $rmx: {
      configurable: true,
      value: root,
    },
  })
  return owner
}

export function disposeClientEntryBoundary(marker: Comment): boolean {
  let boundaryMarker = marker as ClientEntryBoundaryMarker
  let owner = boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER]
  if (!owner) return false

  delete boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER]
  delete boundaryMarker.$rmx
  owner.root.dispose()
  return true
}
