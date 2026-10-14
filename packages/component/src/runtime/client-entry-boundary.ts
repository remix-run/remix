import type { VirtualRoot } from './vdom.ts'

export type ClientEntryIdentity = {
  moduleUrl: string
  exportName: string
}

const HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN = /^t=\d{13}$/

export function getClientEntryKey(identity: ClientEntryIdentity): string {
  return JSON.stringify([getClientEntryComparisonUrl(identity.moduleUrl), identity.exportName])
}

function getHmrTimestampQuerySegmentIndex(querySegments: string[]): number | null {
  let timestampIndex = -1

  for (let index = 0; index < querySegments.length; index++) {
    if (!HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN.test(querySegments[index])) continue
    if (timestampIndex !== -1) return null
    timestampIndex = index
  }

  return timestampIndex === -1 ? null : timestampIndex
}

function getClientEntryComparisonUrl(moduleUrl: string): string {
  let hashIndex = moduleUrl.indexOf('#')
  let urlWithoutHash = hashIndex === -1 ? moduleUrl : moduleUrl.slice(0, hashIndex)
  let hash = hashIndex === -1 ? '' : moduleUrl.slice(hashIndex)
  let queryIndex = urlWithoutHash.indexOf('?')
  if (queryIndex === -1) return moduleUrl

  let pathname = urlWithoutHash.slice(0, queryIndex)
  let query = urlWithoutHash.slice(queryIndex + 1)
  let querySegments = query.split('&')
  let timestampIndex = getHmrTimestampQuerySegmentIndex(querySegments)
  if (timestampIndex === null) return moduleUrl

  querySegments.splice(timestampIndex, 1)
  let comparisonQuery = querySegments.length > 0 ? `?${querySegments.join('&')}` : ''
  return `${pathname}${comparisonQuery}${hash}`
}

type ClientEntryRoot = Pick<VirtualRoot, 'dispose' | 'render'>

export type ClientEntryBoundaryOwner = {
  end: Comment
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
  end: Comment,
  identity: ClientEntryIdentity,
  root: ClientEntryRoot,
): ClientEntryBoundaryOwner {
  let owner = { end, identity, root }
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
