import {
  ROOT_ROUTE_NAME,
  type ControllerOwnership,
  type OwnedSubtree,
  type RouteDirectory,
} from '../controller-ownership.ts'
import type { DoctorFinding } from './types.ts'

export function getControllerFindings(ownership: ControllerOwnership): DoctorFinding[] {
  let missingRouteNames = new Set(
    ownership.routeDirectories
      .filter((directory) => !directory.exists)
      .map((directory) => directory.routeName),
  )

  return [
    ...getSubtreeFindings(ownership.subtrees, missingRouteNames),
    ...getRouteDirectoryFindings(ownership.routeDirectories),
  ]
}

function getRouteDirectoryFindings(directories: RouteDirectory[]): DoctorFinding[] {
  return directories
    .filter((directory) => !directory.exists)
    .map((directory) => ({
      code: 'missing-route-directory' as const,
      expectedPath: directory.directoryPath,
      message: `Route map "${directory.routeName}" is missing action directory ${directory.directoryPath}.`,
      routeName: directory.routeName,
      severity: 'warn' as const,
      suite: 'actions' as const,
    }))
}

function getSubtreeFindings(
  subtrees: OwnedSubtree[],
  missingRouteNames: Set<string>,
): DoctorFinding[] {
  let findings: DoctorFinding[] = []

  for (let subtree of subtrees) {
    if (missingRouteNames.has(subtree.routeName)) {
      continue
    }

    if (subtree.actualEntryPath == null) {
      findings.push({
        code: 'missing-owner',
        expectedPath: subtree.entryDisplayPath,
        message: `${formatRouteMapName(subtree.routeName)} is missing action controller ${subtree.entryDisplayPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'actions',
      })
    }
  }

  return findings
}

function formatRouteMapName(routeName: string): string {
  return routeName === ROOT_ROUTE_NAME ? 'Root route map' : `Route map "${routeName}"`
}
