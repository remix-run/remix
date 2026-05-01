import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  getControllerOwnerCandidates,
  getOwnerModuleBaseName,
  getPreferredOwnerDisplayPath,
  getRouteSubtreePath,
  isControllerEntryFileName,
  toDiskSegment,
} from './controller-files.ts'
import type { RouteTreeNodeKind } from './route-map.ts'

const ACTIONS_PATH_PREFIX = 'app/actions/'

export const ROOT_ROUTE_NAME = '<root>'

export interface OwnershipRouteNode {
  children: OwnershipRouteNode[]
  key: string
  kind: RouteTreeNodeKind
  method?: string
  name: string
}

export interface ControllerDirectoryScan {
  controllerEntryPaths: Set<string>
  rootDirectoryPaths: Set<string>
  routeLocalFilePaths: Set<string>
}

export interface OwnedSubtreePlan {
  entryCandidates: string[]
  entryDisplayPath: string
  routeName: string
  subtreePath: string
}

export interface OwnedSubtree extends OwnedSubtreePlan {
  actualEntryPath: string | null
  actualEntryPaths: string[]
  claimedFilePaths: string[]
  claimedRouteLocalFilePaths: string[]
}

export interface ControllerOwnership {
  orphanControllerPaths: string[]
  orphanRouteDirectoryPaths: string[]
  scan: ControllerDirectoryScan
  subtrees: OwnedSubtree[]
}

export async function inspectControllerOwnership(
  appRoot: string,
  tree: OwnershipRouteNode[],
): Promise<ControllerOwnership> {
  let subtreePlans = buildOwnedSubtrees(tree)
  let scan = await scanControllersDirectory(appRoot)
  let subtrees = applyScanToSubtrees(subtreePlans, scan)

  return {
    orphanControllerPaths: getOrphanControllerPaths(subtreePlans, scan),
    orphanRouteDirectoryPaths: getOrphanRouteDirectoryPaths(subtreePlans, scan),
    scan,
    subtrees,
  }
}

export function buildOwnedSubtrees(
  tree: OwnershipRouteNode[],
  parentSegments: string[] = [],
  subtrees: OwnedSubtreePlan[] = [],
): OwnedSubtreePlan[] {
  if (
    parentSegments.length === 0 &&
    subtrees.length === 0 &&
    tree.some((node) => node.kind === 'route')
  ) {
    addSubtreePlan(ROOT_ROUTE_NAME, [], subtrees)
  }

  for (let node of tree) {
    if (node.kind !== 'group') {
      continue
    }

    let segments = [...parentSegments, toDiskSegment(node.key)]
    addSubtreePlan(node.name, segments, subtrees)
    buildOwnedSubtrees(node.children, segments, subtrees)
  }

  return subtrees
}

function addSubtreePlan(routeName: string, segments: string[], subtrees: OwnedSubtreePlan[]): void {
  let entryCandidates = getControllerOwnerCandidates(segments)

  subtrees.push({
    entryCandidates,
    entryDisplayPath: getPreferredOwnerDisplayPath(entryCandidates),
    routeName,
    subtreePath: getRouteSubtreePath(segments),
  })
}

async function scanControllersDirectory(appRoot: string): Promise<ControllerDirectoryScan> {
  let actionsDir = path.join(appRoot, 'app', 'actions')
  let controllerEntryPaths = new Set<string>()
  let rootDirectoryPaths = new Set<string>()
  let routeLocalFilePaths = new Set<string>()

  async function walk(currentDir: string, isRoot: boolean): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch (error) {
      let nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT' && isRoot) {
        return
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

      if (isRouteLocalFileName(entry.name)) {
        routeLocalFilePaths.add(relativePath)
      }
    }
  }

  await walk(actionsDir, true)

  return {
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
    let actualEntryPaths = findOwnerPaths(scan, subtree.entryCandidates)

    return {
      ...subtree,
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

function getOrphanControllerPaths(
  subtreePlans: OwnedSubtreePlan[],
  scan: ControllerDirectoryScan,
): string[] {
  let expectedControllerPaths = new Set(subtreePlans.flatMap((subtree) => subtree.entryCandidates))

  return [...scan.controllerEntryPaths]
    .filter((filePath) => !expectedControllerPaths.has(filePath))
    .sort()
}

function getOrphanRouteDirectoryPaths(
  subtreePlans: OwnedSubtreePlan[],
  scan: ControllerDirectoryScan,
): string[] {
  let expectedRootDirectories = new Set(
    subtreePlans
      .map((subtree) => getTopLevelSubtreePath(subtree.subtreePath))
      .filter((subtreePath) => subtreePath !== getRouteSubtreePath([])),
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

function isRouteLocalFileName(fileName: string): boolean {
  let baseName = getOwnerModuleBaseName(fileName)

  return (
    baseName != null &&
    baseName !== 'controller' &&
    !baseName.endsWith('.test') &&
    !baseName.endsWith('.spec')
  )
}

function findOwnerPaths(scan: ControllerDirectoryScan, candidatePaths: string[]): string[] {
  let existingPaths: string[] = []

  for (let candidatePath of candidatePaths) {
    if (scan.controllerEntryPaths.has(candidatePath)) {
      existingPaths.push(candidatePath)
    }
  }

  return existingPaths
}

function isNestedControllerPath(filePath: string): boolean {
  return (
    filePath.startsWith(ACTIONS_PATH_PREFIX) &&
    filePath.slice(ACTIONS_PATH_PREFIX.length).includes('/')
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
  let actionsRoot = getRouteSubtreePath([])
  if (subtreePath === actionsRoot) {
    return actionsRoot
  }

  let subtreeSegments = subtreePath.slice(ACTIONS_PATH_PREFIX.length).split('/')
  return getRouteSubtreePath([subtreeSegments[0]])
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
