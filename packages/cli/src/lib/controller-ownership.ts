import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  getControllerOwnerCandidates,
  getPreferredOwnerDisplayPath,
  getRouteSubtreePath,
  toDiskSegment,
} from './controller-files.ts'
import type { RouteTreeNodeKind } from './route-map.ts'

export const ROOT_ROUTE_NAME = '<root>'

export interface OwnershipRouteNode {
  children: OwnershipRouteNode[]
  key: string
  kind: RouteTreeNodeKind
  method?: string
  name: string
}

export interface RouteDirectoryPlan {
  directoryPath: string
  routeName: string
}

export interface RouteDirectory extends RouteDirectoryPlan {
  exists: boolean
}

export interface OwnedSubtreePlan {
  entryCandidates: string[]
  entryDisplayPath: string
  routeName: string
  subtreePath: string
}

export interface OwnedSubtree extends OwnedSubtreePlan {
  actualEntryPath: string | null
}

export interface ControllerOwnership {
  routeDirectories: RouteDirectory[]
  subtrees: OwnedSubtree[]
}

export async function inspectControllerOwnership(
  appRoot: string,
  tree: OwnershipRouteNode[],
): Promise<ControllerOwnership> {
  let subtreePlans = buildOwnedSubtrees(tree)
  let routeDirectoryPlans = buildRouteDirectories(tree)
  let [routeDirectories, subtrees] = await Promise.all([
    inspectRouteDirectories(appRoot, routeDirectoryPlans),
    inspectOwnedSubtrees(appRoot, subtreePlans),
  ])

  return {
    routeDirectories,
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
    if (hasDirectRouteLeaf(node.children)) {
      addSubtreePlan(node.name, segments, subtrees)
    }
    buildOwnedSubtrees(node.children, segments, subtrees)
  }

  return subtrees
}

export function buildRouteDirectories(
  tree: OwnershipRouteNode[],
  parentSegments: string[] = [],
  directories: RouteDirectoryPlan[] = [],
): RouteDirectoryPlan[] {
  for (let node of tree) {
    if (node.kind !== 'group') {
      continue
    }

    let segments = [...parentSegments, toDiskSegment(node.key)]
    directories.push({
      directoryPath: getRouteSubtreePath(segments),
      routeName: node.name,
    })
    buildRouteDirectories(node.children, segments, directories)
  }

  return directories
}

function hasDirectRouteLeaf(tree: OwnershipRouteNode[]): boolean {
  return tree.some((node) => node.kind === 'route')
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

async function inspectRouteDirectories(
  appRoot: string,
  plans: RouteDirectoryPlan[],
): Promise<RouteDirectory[]> {
  return Promise.all(
    plans.map(async (plan) => ({
      ...plan,
      exists: await pathHasType(appRoot, plan.directoryPath, 'directory'),
    })),
  )
}

async function inspectOwnedSubtrees(
  appRoot: string,
  plans: OwnedSubtreePlan[],
): Promise<OwnedSubtree[]> {
  return Promise.all(
    plans.map(async (plan) => ({
      ...plan,
      actualEntryPath: await findControllerEntryPath(appRoot, plan.entryCandidates),
    })),
  )
}

async function findControllerEntryPath(
  appRoot: string,
  candidatePaths: string[],
): Promise<string | null> {
  for (let candidatePath of candidatePaths) {
    if (await pathHasType(appRoot, candidatePath, 'file')) {
      return candidatePath
    }
  }

  return null
}

async function pathHasType(
  appRoot: string,
  relativePath: string,
  type: 'directory' | 'file',
): Promise<boolean> {
  try {
    let stats = await fs.stat(path.join(appRoot, relativePath))
    return type === 'directory' ? stats.isDirectory() : stats.isFile()
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
      return false
    }

    throw error
  }
}
