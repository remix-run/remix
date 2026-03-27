import { inspectControllerOwnership, type OwnedSubtree } from '../controller-ownership.ts'
import type { LoadedRouteMap } from '../route-map.ts'

export type DoctorSuiteName = 'controllers'
export type DoctorFindingSeverity = 'warn' | 'advice'
export type DoctorFindingCode =
  | 'missing-owner'
  | 'wrong-owner-kind'
  | 'ambiguous-owner'
  | 'duplicate-owner-file'
  | 'incomplete-controller'
  | 'promotion-drift'
  | 'orphan-action'
  | 'orphan-controller'
  | 'orphan-route-directory'

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

export async function checkControllerConventions(
  routeMap: LoadedRouteMap,
): Promise<DoctorSuiteResult> {
  let ownership = await inspectControllerOwnership(routeMap)
  let findings = [
    ...getSubtreeFindings(ownership.subtrees),
    ...ownership.orphanActionPaths.map((actualPath) => ({
      actualPath,
      code: 'orphan-action' as const,
      message: `Standalone action ${actualPath} does not match any top-level route.`,
      severity: 'warn' as const,
      suite: 'controllers' as const,
    })),
    ...ownership.orphanControllerPaths.map((actualPath) => ({
      actualPath,
      code: 'orphan-controller' as const,
      message: `Controller ${actualPath} does not match any route group.`,
      severity: 'warn' as const,
      suite: 'controllers' as const,
    })),
    ...ownership.orphanRouteDirectoryPaths.map((actualPath) => ({
      actualPath,
      code: 'orphan-route-directory' as const,
      message: `Directory ${actualPath} does not match any route subtree.`,
      severity: 'warn' as const,
      suite: 'controllers' as const,
    })),
  ]

  return {
    findings,
    name: 'controllers',
  }
}

function getSubtreeFindings(subtrees: OwnedSubtree[]): DoctorFinding[] {
  let findings: DoctorFinding[] = []

  for (let subtree of subtrees) {
    let actualEntryPath = subtree.actualEntryPath ?? undefined
    let actualAlternatePath = subtree.actualAlternatePath ?? undefined

    if (subtree.actualEntryPaths.length > 1) {
      findings.push({
        actualPath: subtree.actualEntryPaths[0],
        code: 'duplicate-owner-file',
        expectedPath: subtree.entryDisplayPath,
        message: `Route "${subtree.routeName}" has multiple ${subtree.kind} files: ${subtree.actualEntryPaths.join(', ')}. Keep only one ${subtree.kind} owner file.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.actualAlternatePaths.length > 1) {
      let alternateKind = subtree.kind === 'action' ? 'controller' : 'action'

      findings.push({
        actualPath: subtree.actualAlternatePaths[0],
        code: 'duplicate-owner-file',
        expectedPath: subtree.entryDisplayPath,
        message: `Route "${subtree.routeName}" has multiple ${alternateKind} files: ${subtree.actualAlternatePaths.join(', ')}. Keep only one ${alternateKind} owner file.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (actualEntryPath != null && actualAlternatePath != null) {
      findings.push({
        actualPath: actualAlternatePath,
        code: 'ambiguous-owner',
        expectedPath: actualEntryPath,
        message:
          subtree.kind === 'action'
            ? `Route "${subtree.routeName}" has both action ${actualEntryPath} and controller ${actualAlternatePath}.`
            : `Route "${subtree.routeName}" has both controller ${actualEntryPath} and standalone action ${actualAlternatePath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (actualAlternatePath != null) {
      findings.push({
        actualPath: actualAlternatePath,
        code: 'wrong-owner-kind',
        expectedPath: subtree.entryDisplayPath,
        message:
          subtree.kind === 'action'
            ? `Route "${subtree.routeName}" expects action ${subtree.entryDisplayPath}, but found controller ${actualAlternatePath}.`
            : `Route "${subtree.routeName}" expects controller ${subtree.entryDisplayPath}, but found standalone action ${actualAlternatePath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.kind === 'controller' && subtree.actualEntryPath == null) {
      if (subtree.claimedFilePaths.length > 0) {
        findings.push({
          actualPath: subtree.subtreePath,
          code: 'incomplete-controller',
          expectedPath: subtree.entryDisplayPath,
          message: `Route "${subtree.routeName}" has files under ${subtree.subtreePath}, but is missing controller ${subtree.entryDisplayPath}.`,
          routeName: subtree.routeName,
          severity: 'warn',
          suite: 'controllers',
        })
        continue
      }

      findings.push({
        code: 'missing-owner',
        expectedPath: subtree.entryDisplayPath,
        message: `Route "${subtree.routeName}" is missing controller ${subtree.entryDisplayPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.kind === 'action' && subtree.claimedFilePaths.length > 0) {
      findings.push({
        actualPath: subtree.subtreePath,
        code: 'promotion-drift',
        expectedPath: actualEntryPath ?? subtree.entryDisplayPath,
        message:
          actualEntryPath == null
            ? `Route "${subtree.routeName}" has files under ${subtree.subtreePath}, but is still expected to use action ${subtree.entryDisplayPath}. Promote it to controller ${subtree.alternateDisplayPath} or move the files back into ${subtree.entryDisplayPath}.`
            : `Route "${subtree.routeName}" uses action ${actualEntryPath}, but also has files under ${subtree.subtreePath}. Promote it to controller ${subtree.alternateDisplayPath} or keep the route in ${actualEntryPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.actualEntryPath == null) {
      findings.push({
        code: 'missing-owner',
        expectedPath: subtree.entryDisplayPath,
        message: `Route "${subtree.routeName}" is missing action ${subtree.entryDisplayPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
    }
  }

  return findings
}
