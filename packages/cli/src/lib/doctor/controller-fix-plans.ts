import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  getOwnerCandidateForExtension,
  getOwnerFileExtension,
  type OwnerFileExtension,
} from '../controller-files.ts'
import type {
  ControllerOwnership,
  OwnedSubtree,
  OwnershipRouteNode,
} from '../controller-ownership.ts'
import { ROOT_ROUTE_NAME } from '../controller-ownership.ts'
import { renderControllerPlaceholder } from './controller-placeholders.ts'
import type { DoctorFixPlan } from './types.ts'

const OWNER_EXTENSION_PRIORITY: OwnerFileExtension[] = ['.tsx', '.ts', '.jsx', '.js']

export async function getControllerFixPlans(
  appRoot: string,
  tree: OwnershipRouteNode[],
  ownership: ControllerOwnership,
): Promise<DoctorFixPlan[]> {
  let routeNodesByName = getRouteNodesByName(tree)
  let hasTsconfig = await pathExists(path.join(appRoot, 'tsconfig.json'))
  let resolvedEntryPathByRouteName = new Map<string, string>()

  for (let subtree of ownership.subtrees) {
    if (subtree.actualEntryPath != null) {
      resolvedEntryPathByRouteName.set(subtree.routeName, subtree.actualEntryPath)
      continue
    }

    let fixCode = getFixCodeForSubtree(subtree)
    if (fixCode == null) {
      continue
    }

    let extension = inferOwnerExtension(subtree, ownership, hasTsconfig)
    let targetPath =
      getOwnerCandidateForExtension(subtree.entryCandidates, extension) ?? subtree.entryDisplayPath

    resolvedEntryPathByRouteName.set(subtree.routeName, targetPath)
  }

  let fixPlans: DoctorFixPlan[] = []

  for (let subtree of ownership.subtrees) {
    let code = getFixCodeForSubtree(subtree)
    if (code == null) {
      continue
    }

    let routeNode = routeNodesByName.get(subtree.routeName)
    let entryPath = resolvedEntryPathByRouteName.get(subtree.routeName)
    if (routeNode == null || entryPath == null) {
      continue
    }

    let contents = renderControllerPlaceholder(routeNode, entryPath)

    fixPlans.push({
      code,
      contents,
      kind: 'create-file',
      path: entryPath,
      routeName: subtree.routeName,
      suite: 'actions',
    })
  }

  return fixPlans
}

function getFixCodeForSubtree(subtree: OwnedSubtree): DoctorFixPlan['code'] | null {
  if (subtree.actualEntryPaths.length > 1) {
    return null
  }

  if (subtree.actualEntryPath != null) {
    return null
  }

  return subtree.claimedFilePaths.length > 0 ? 'incomplete-controller' : 'missing-owner'
}

function inferOwnerExtension(
  subtree: OwnedSubtree,
  ownership: ControllerOwnership,
  hasTsconfig: boolean,
): OwnerFileExtension {
  let subtreeExtension = getMostCommonOwnerExtension(subtree.claimedRouteLocalFilePaths)
  if (subtreeExtension != null) {
    return subtreeExtension
  }

  let projectExtension = getMostCommonOwnerExtension([...ownership.scan.controllerEntryPaths])
  if (projectExtension != null) {
    return projectExtension
  }

  return hasTsconfig ? '.tsx' : '.js'
}

function getMostCommonOwnerExtension(filePaths: string[]): OwnerFileExtension | null {
  let counts = new Map<OwnerFileExtension, number>()

  for (let filePath of filePaths) {
    let extension = getOwnerFileExtension(filePath)
    if (extension == null) {
      continue
    }

    counts.set(extension, (counts.get(extension) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return null
  }

  let bestExtension: OwnerFileExtension | null = null
  let bestCount = -1

  for (let extension of OWNER_EXTENSION_PRIORITY) {
    let count = counts.get(extension) ?? 0
    if (count > bestCount) {
      bestCount = count
      bestExtension = extension
    }
  }

  return bestExtension
}

function getRouteNodesByName(tree: OwnershipRouteNode[]): Map<string, OwnershipRouteNode> {
  let routeNodesByName = new Map<string, OwnershipRouteNode>()
  routeNodesByName.set(ROOT_ROUTE_NAME, {
    children: tree,
    key: ROOT_ROUTE_NAME,
    kind: 'group',
    name: ROOT_ROUTE_NAME,
  })

  function visit(nodes: OwnershipRouteNode[]): void {
    for (let node of nodes) {
      routeNodesByName.set(node.name, node)
      visit(node.children)
    }
  }

  visit(tree)
  return routeNodesByName
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return false
    }

    throw error
  }
}
