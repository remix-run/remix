import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  getActionOwnerCandidates,
  getControllerOwnerCandidates,
  getOwnerModuleBaseName,
  getPreferredOwnerDisplayPath,
  getRouteSubtreePath,
  isActionFileName,
  isControllerEntryFileName,
} from './controller-files.ts'
import type { LoadedRouteMap, RouteOwnerKind, RouteTreeNode } from './route-map.ts'

export interface ControllerDirectoryScan {
  actionEntryPaths: Set<string>
  controllerEntryPaths: Set<string>
  rootDirectoryPaths: Set<string>
  routeLocalFilePaths: Set<string>
}

export interface OwnedSubtreePlan {
  alternateCandidates: string[]
  alternateDisplayPath: string
  entryCandidates: string[]
  entryDisplayPath: string
  kind: RouteOwnerKind
  routeName: string
  subtreePath: string
}

export interface OwnedSubtree extends OwnedSubtreePlan {
  actualAlternatePath: string | null
  actualAlternatePaths: string[]
  actualEntryPath: string | null
  actualEntryPaths: string[]
  claimedFilePaths: string[]
  claimedRouteLocalFilePaths: string[]
}

export interface ControllerOwnership {
  orphanActionPaths: string[]
  orphanControllerPaths: string[]
  orphanRouteDirectoryPaths: string[]
  scan: ControllerDirectoryScan
  subtrees: OwnedSubtree[]
}

export async function inspectControllerOwnership(
  routeMap: LoadedRouteMap,
): Promise<ControllerOwnership> {
  let subtreePlans = buildOwnedSubtrees(routeMap.tree)
  let scan = await scanControllersDirectory(routeMap.appRoot)
  let subtrees = applyScanToSubtrees(subtreePlans, scan)

  return {
    orphanActionPaths: getOrphanActionPaths(subtreePlans, scan),
    orphanControllerPaths: getOrphanControllerPaths(subtreePlans, scan),
    orphanRouteDirectoryPaths: getOrphanRouteDirectoryPaths(subtreePlans, scan),
    scan,
    subtrees,
  }
}

export function buildOwnedSubtrees(
  tree: RouteTreeNode[],
  depth: number = 0,
  subtrees: OwnedSubtreePlan[] = [],
): OwnedSubtreePlan[] {
  for (let node of tree) {
    if (node.kind === 'group') {
      let segments = node.name.split('.')
      subtrees.push({
        alternateCandidates: getActionOwnerCandidates(segments),
        alternateDisplayPath: getPreferredOwnerDisplayPath(getActionOwnerCandidates(segments)),
        entryCandidates: getControllerOwnerCandidates(segments),
        entryDisplayPath: getPreferredOwnerDisplayPath(getControllerOwnerCandidates(segments)),
        kind: 'controller',
        routeName: node.name,
        subtreePath: getRouteSubtreePath(segments),
      })
      buildOwnedSubtrees(node.children, depth + 1, subtrees)
      continue
    }

    if (depth > 0) {
      continue
    }

    let segments = [node.key]
    subtrees.push({
      alternateCandidates: getControllerOwnerCandidates(segments),
      alternateDisplayPath: getPreferredOwnerDisplayPath(getControllerOwnerCandidates(segments)),
      entryCandidates: getActionOwnerCandidates(segments),
      entryDisplayPath: getPreferredOwnerDisplayPath(getActionOwnerCandidates(segments)),
      kind: 'action',
      routeName: node.name,
      subtreePath: getRouteSubtreePath(segments),
    })
  }

  return subtrees
}

async function scanControllersDirectory(appRoot: string): Promise<ControllerDirectoryScan> {
  let controllersDir = path.join(appRoot, 'app', 'controllers')
  let controllerEntryPaths = new Set<string>()
  let actionEntryPaths = new Set<string>()
  let rootDirectoryPaths = new Set<string>()
  let routeLocalFilePaths = new Set<string>()

  async function walk(currentDir: string, isRoot: boolean): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch (error) {
      let nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        throw new Error('Could not read app/controllers. Run this command inside a Remix app.')
      }

      throw error
    }

    for (let entry of entries) {
      let entryPath = path.join(currentDir, entry.name)
      let relativePath = normalizeRelativePath(path.relative(appRoot, entryPath))

      if (entry.isDirectory()) {
        if (isRoot) {
          rootDirectoryPaths.add(relativePath)
        }

        await walk(entryPath, false)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (isControllerEntryFileName(entry.name)) {
        controllerEntryPaths.add(relativePath)
        continue
      }

      if (isRoot && isActionCandidate(entry.name)) {
        actionEntryPaths.add(relativePath)
        continue
      }

      if (!isRoot && isRouteLocalFileName(entry.name)) {
        routeLocalFilePaths.add(relativePath)
      }
    }
  }

  await walk(controllersDir, true)

  return {
    actionEntryPaths,
    controllerEntryPaths,
    rootDirectoryPaths,
    routeLocalFilePaths,
  }
}

function applyScanToSubtrees(
  subtreePlans: OwnedSubtreePlan[],
  scan: ControllerDirectoryScan,
): OwnedSubtree[] {
  let claimedRouteLocalPaths = claimFilesToDeepestSubtree(
    [...scan.routeLocalFilePaths],
    subtreePlans,
  )
  let claimedContentPaths = claimFilesToDeepestSubtree(getNestedContentPaths(scan), subtreePlans)

  return subtreePlans.map((subtree) => {
    let actualAlternatePaths = findOwnerPaths(
      scan,
      invertOwnerKind(subtree.kind),
      subtree.alternateCandidates,
    )
    let actualEntryPaths = findOwnerPaths(scan, subtree.kind, subtree.entryCandidates)

    return {
      ...subtree,
      actualAlternatePath: actualAlternatePaths[0] ?? null,
      actualAlternatePaths,
      actualEntryPath: actualEntryPaths[0] ?? null,
      actualEntryPaths,
      claimedFilePaths: claimedContentPaths.get(subtree.routeName) ?? [],
      claimedRouteLocalFilePaths: claimedRouteLocalPaths.get(subtree.routeName) ?? [],
    }
  })
}

function getNestedContentPaths(scan: ControllerDirectoryScan): string[] {
  let nestedControllerPaths = [...scan.controllerEntryPaths].filter((filePath) =>
    isNestedControllerPath(filePath),
  )

  return [...new Set([...nestedControllerPaths, ...scan.routeLocalFilePaths])].sort()
}

function claimFilesToDeepestSubtree(
  filePaths: string[],
  subtreePlans: OwnedSubtreePlan[],
): Map<string, string[]> {
  let subtreesByDepth = [...subtreePlans].sort((left, right) => {
    if (right.subtreePath.length !== left.subtreePath.length) {
      return right.subtreePath.length - left.subtreePath.length
    }

    return left.routeName.localeCompare(right.routeName)
  })
  let claims = new Map<string, string[]>()

  for (let filePath of filePaths.sort()) {
    let matchingSubtree = subtreesByDepth.find((subtree) =>
      isWithinDirectory(filePath, subtree.subtreePath),
    )

    if (matchingSubtree == null) {
      continue
    }

    let claimedPaths = claims.get(matchingSubtree.routeName)
    if (claimedPaths == null) {
      claims.set(matchingSubtree.routeName, [filePath])
      continue
    }

    claimedPaths.push(filePath)
  }

  return claims
}

function getOrphanActionPaths(
  subtreePlans: OwnedSubtreePlan[],
  scan: ControllerDirectoryScan,
): string[] {
  let expectedActionPaths = new Set(
    subtreePlans
      .filter((subtree) => subtree.kind === 'action')
      .flatMap((subtree) => subtree.entryCandidates),
  )
  let alternateActionPaths = new Set(
    subtreePlans
      .filter((subtree) => subtree.kind === 'controller')
      .flatMap((subtree) => subtree.alternateCandidates),
  )

  return [...scan.actionEntryPaths]
    .filter((filePath) => !expectedActionPaths.has(filePath))
    .filter((filePath) => !alternateActionPaths.has(filePath))
    .sort()
}

function getOrphanControllerPaths(
  subtreePlans: OwnedSubtreePlan[],
  scan: ControllerDirectoryScan,
): string[] {
  let expectedControllerPaths = new Set(
    subtreePlans
      .filter((subtree) => subtree.kind === 'controller')
      .flatMap((subtree) => subtree.entryCandidates),
  )
  let alternateControllerPaths = new Set(
    subtreePlans
      .filter((subtree) => subtree.kind === 'action')
      .flatMap((subtree) => subtree.alternateCandidates),
  )

  return [...scan.controllerEntryPaths]
    .filter((filePath) => !expectedControllerPaths.has(filePath))
    .filter((filePath) => !alternateControllerPaths.has(filePath))
    .sort()
}

function getOrphanRouteDirectoryPaths(
  subtreePlans: OwnedSubtreePlan[],
  scan: ControllerDirectoryScan,
): string[] {
  let expectedRootDirectories = new Set(
    subtreePlans.map((subtree) => getTopLevelSubtreePath(subtree.subtreePath)),
  )
  let actualControllerDirectories = [...scan.controllerEntryPaths].map((controllerPath) =>
    normalizeRelativePath(path.dirname(controllerPath)),
  )

  return [...scan.rootDirectoryPaths]
    .filter((directoryPath) => !expectedRootDirectories.has(directoryPath))
    .filter(
      (directoryPath) =>
        !actualControllerDirectories.some((controllerPath) =>
          isDirectoryWithinDirectory(controllerPath, directoryPath),
        ),
    )
    .sort()
}

function hasOwnerPath(
  scan: ControllerDirectoryScan,
  kind: RouteOwnerKind,
  filePath: string,
): boolean {
  return kind === 'action'
    ? scan.actionEntryPaths.has(filePath)
    : scan.controllerEntryPaths.has(filePath)
}

function invertOwnerKind(kind: RouteOwnerKind): RouteOwnerKind {
  return kind === 'action' ? 'controller' : 'action'
}

function isActionCandidate(fileName: string): boolean {
  return isActionFileName(fileName)
}

function isRouteLocalFileName(fileName: string): boolean {
  let baseName = getOwnerModuleBaseName(fileName)

  return (
    baseName != null &&
    baseName !== 'controller' &&
    !baseName.endsWith('.test') &&
    !baseName.endsWith('.spec')
  )
}

function findOwnerPath(
  scan: ControllerDirectoryScan,
  kind: RouteOwnerKind,
  candidatePaths: string[],
): string | null {
  return findOwnerPaths(scan, kind, candidatePaths)[0] ?? null
}

function findOwnerPaths(
  scan: ControllerDirectoryScan,
  kind: RouteOwnerKind,
  candidatePaths: string[],
): string[] {
  let existingPaths: string[] = []

  for (let candidatePath of candidatePaths) {
    if (hasOwnerPath(scan, kind, candidatePath)) {
      existingPaths.push(candidatePath)
    }
  }

  return existingPaths
}

function isNestedControllerPath(filePath: string): boolean {
  return (
    filePath.startsWith('app/controllers/') &&
    filePath.slice('app/controllers/'.length).includes('/')
  )
}

function isWithinDirectory(filePath: string, directoryPath: string): boolean {
  return filePath.startsWith(`${directoryPath}/`)
}

function isDirectoryWithinDirectory(directoryPath: string, parentDirectoryPath: string): boolean {
  return (
    directoryPath === parentDirectoryPath || isWithinDirectory(directoryPath, parentDirectoryPath)
  )
}

function getTopLevelSubtreePath(subtreePath: string): string {
  let subtreeSegments = subtreePath.slice('app/controllers/'.length).split('/')
  return getRouteSubtreePath([subtreeSegments[0]])
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
