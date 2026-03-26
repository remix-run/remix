import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  getActionOwnerCandidates,
  getControllerOwnerCandidates,
  getOwnerModuleBaseName,
  getPreferredOwnerDisplayPath,
  isControllerEntryFileName,
  isActionFileName,
} from '../controller-files.ts'
import type { LoadedRouteMap, RouteOwnerKind, RouteTreeNode } from '../route-map.ts'

export type DoctorSuiteName = 'controllers'
export type DoctorFindingSeverity = 'warn' | 'advice'
export type DoctorFindingCode =
  | 'missing-owner'
  | 'wrong-owner-kind'
  | 'ambiguous-owner'
  | 'orphan-action'
  | 'orphan-controller'
  | 'generic-bucket'

export interface DoctorFinding {
  actualPath?: string
  code: DoctorFindingCode
  expectedPath?: string
  message: string
  routeName?: string
  severity: DoctorFindingSeverity
  suite: DoctorSuiteName
}

export interface DoctorSuiteResult {
  findings: DoctorFinding[]
  name: DoctorSuiteName
}

interface ExpectedOwner {
  alternateCandidates: string[]
  expectedCandidates: string[]
  kind: RouteOwnerKind
  routeName: string
}

interface ControllerDirectoryScan {
  controllerPaths: Set<string>
  actionPaths: Set<string>
  genericBucketPaths: string[]
  topLevelActionPaths: Set<string>
}

const GENERIC_BUCKET_DIRECTORIES = new Set(['components', 'lib', 'shared', 'utils'])
const GENERIC_BUCKET_FILE_BASENAMES = new Set(['helpers', 'common', 'misc'])

export async function checkControllerConventions(
  routeMap: LoadedRouteMap,
): Promise<DoctorSuiteResult> {
  let expectedOwners = collectExpectedOwners(routeMap.tree)
  let scan = await scanControllersDirectory(routeMap.appRoot)
  let findings = [
    ...getExpectedOwnerFindings(expectedOwners, scan),
    ...getOrphanFindings(expectedOwners, scan),
    ...getGenericBucketFindings(scan),
  ]

  return {
    findings,
    name: 'controllers',
  }
}

function collectExpectedOwners(
  tree: RouteTreeNode[],
  depth: number = 0,
  expectedOwners: ExpectedOwner[] = [],
): ExpectedOwner[] {
  for (let node of tree) {
    if (node.kind === 'group') {
      let segments = node.name.split('.')
      expectedOwners.push({
        alternateCandidates: getActionOwnerCandidates(segments),
        expectedCandidates: getControllerOwnerCandidates(segments),
        kind: node.owner.kind,
        routeName: node.name,
      })
      collectExpectedOwners(node.children, depth + 1, expectedOwners)
      continue
    }

    if (depth > 0) {
      continue
    }

    expectedOwners.push({
      alternateCandidates: getControllerOwnerCandidates([node.key]),
      expectedCandidates: getActionOwnerCandidates([node.key]),
      kind: node.owner.kind,
      routeName: node.name,
    })
  }

  return expectedOwners
}

async function scanControllersDirectory(appRoot: string): Promise<ControllerDirectoryScan> {
  let controllersDir = path.join(appRoot, 'app', 'controllers')
  let controllerPaths = new Set<string>()
  let actionPaths = new Set<string>()
  let genericBucketPaths: string[] = []
  let topLevelActionPaths = new Set<string>()

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
        if (GENERIC_BUCKET_DIRECTORIES.has(entry.name)) {
          genericBucketPaths.push(relativePath)
        }

        await walk(entryPath, false)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (isControllerEntryFileName(entry.name)) {
        controllerPaths.add(relativePath)
        continue
      }

      if (isGenericBucketFileName(entry.name)) {
        genericBucketPaths.push(relativePath)
      }

      if (!isActionCandidate(entry.name)) {
        continue
      }

      actionPaths.add(relativePath)

      if (isRoot) {
        topLevelActionPaths.add(relativePath)
      }
    }
  }

  await walk(controllersDir, true)

  return {
    controllerPaths,
    actionPaths,
    genericBucketPaths: genericBucketPaths.sort(),
    topLevelActionPaths,
  }
}

function getExpectedOwnerFindings(
  expectedOwners: ExpectedOwner[],
  scan: ControllerDirectoryScan,
): DoctorFinding[] {
  let findings: DoctorFinding[] = []

  for (let owner of expectedOwners) {
    let expectedPath = findOwnerPath(scan, owner.kind, owner.expectedCandidates)
    let alternatePath = findOwnerPath(scan, invertOwnerKind(owner.kind), owner.alternateCandidates)
    let expectedDisplayPath = expectedPath ?? getPreferredOwnerDisplayPath(owner.expectedCandidates)
    let expectedExists = expectedPath != null
    let alternateExists = alternatePath != null

    if (expectedExists && alternateExists) {
      let actualAlternatePath = alternatePath ?? undefined

      findings.push({
        actualPath: actualAlternatePath,
        code: 'ambiguous-owner',
        expectedPath: expectedDisplayPath,
        message:
          owner.kind === 'action'
            ? `Route "${owner.routeName}" has both action ${expectedDisplayPath} and controller ${actualAlternatePath}.`
            : `Route "${owner.routeName}" has both controller ${expectedDisplayPath} and standalone action ${actualAlternatePath}.`,
        routeName: owner.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (alternateExists) {
      let actualAlternatePath = alternatePath ?? undefined

      findings.push({
        actualPath: actualAlternatePath,
        code: 'wrong-owner-kind',
        expectedPath: expectedDisplayPath,
        message:
          owner.kind === 'action'
            ? `Route "${owner.routeName}" expects action ${expectedDisplayPath}, but found controller ${actualAlternatePath}.`
            : `Route "${owner.routeName}" expects controller ${expectedDisplayPath}, but found standalone action ${actualAlternatePath}.`,
        routeName: owner.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (!expectedExists) {
      findings.push({
        code: 'missing-owner',
        expectedPath: expectedDisplayPath,
        message:
          owner.kind === 'action'
            ? `Route "${owner.routeName}" is missing action ${expectedDisplayPath}.`
            : `Route "${owner.routeName}" is missing controller ${expectedDisplayPath}.`,
        routeName: owner.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
    }
  }

  return findings
}

function getOrphanFindings(
  expectedOwners: ExpectedOwner[],
  scan: ControllerDirectoryScan,
): DoctorFinding[] {
  let findings: DoctorFinding[] = []
  let expectedActionPaths = new Set(
    expectedOwners
      .filter((owner) => owner.kind === 'action')
      .flatMap((owner) => owner.expectedCandidates),
  )
  let expectedControllerPaths = new Set(
    expectedOwners
      .filter((owner) => owner.kind === 'controller')
      .flatMap((owner) => owner.expectedCandidates),
  )
  let alternateActionPaths = new Set(
    expectedOwners
      .filter((owner) => owner.kind === 'controller')
      .flatMap((owner) => owner.alternateCandidates),
  )
  let alternateControllerPaths = new Set(
    expectedOwners
      .filter((owner) => owner.kind === 'action')
      .flatMap((owner) => owner.alternateCandidates),
  )

  let orphanActions = [...scan.topLevelActionPaths]
    .filter((filePath) => !expectedActionPaths.has(filePath))
    .filter((filePath) => !alternateActionPaths.has(filePath))
    .sort()
  let orphanControllers = [...scan.controllerPaths]
    .filter((filePath) => !expectedControllerPaths.has(filePath))
    .filter((filePath) => !alternateControllerPaths.has(filePath))
    .sort()

  for (let actualPath of orphanActions) {
    findings.push({
      actualPath,
      code: 'orphan-action',
      message: `Standalone action ${actualPath} does not match any top-level route.`,
      severity: 'warn',
      suite: 'controllers',
    })
  }

  for (let actualPath of orphanControllers) {
    findings.push({
      actualPath,
      code: 'orphan-controller',
      message: `Controller ${actualPath} does not match any route group.`,
      severity: 'warn',
      suite: 'controllers',
    })
  }

  return findings
}

function getGenericBucketFindings(scan: ControllerDirectoryScan): DoctorFinding[] {
  return scan.genericBucketPaths.map((actualPath) => ({
    actualPath,
    code: 'generic-bucket',
    message: `${actualPath} uses a generic shared-bucket name inside app/controllers.`,
    severity: 'advice',
    suite: 'controllers',
  }))
}

function hasOwnerPath(
  scan: ControllerDirectoryScan,
  kind: RouteOwnerKind,
  filePath: string,
): boolean {
  return kind === 'action' ? scan.actionPaths.has(filePath) : scan.controllerPaths.has(filePath)
}

function invertOwnerKind(kind: RouteOwnerKind): RouteOwnerKind {
  return kind === 'action' ? 'controller' : 'action'
}

function isActionCandidate(fileName: string): boolean {
  return isActionFileName(fileName) && !isGenericBucketFileName(fileName)
}

function findOwnerPath(
  scan: ControllerDirectoryScan,
  kind: RouteOwnerKind,
  candidatePaths: string[],
): string | null {
  for (let candidatePath of candidatePaths) {
    if (hasOwnerPath(scan, kind, candidatePath)) {
      return candidatePath
    }
  }

  return null
}

function isGenericBucketFileName(fileName: string): boolean {
  let baseName = getOwnerModuleBaseName(fileName)
  return baseName != null && GENERIC_BUCKET_FILE_BASENAMES.has(baseName)
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
