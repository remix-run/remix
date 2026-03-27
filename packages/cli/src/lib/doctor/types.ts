export type DoctorSuiteName = 'environment' | 'project' | 'controllers'
export type DoctorFindingSeverity = 'warn' | 'advice'
export type DoctorSuiteStatus = 'ok' | 'issues' | 'skipped'

export type DoctorFindingCode =
  | 'project-root-not-found'
  | 'package-json-read-failed'
  | 'package-json-invalid'
  | 'node-engine-missing'
  | 'node-engine-unparseable'
  | 'node-version-unsupported'
  | 'remix-dependency-missing'
  | 'remix-install-missing'
  | 'routes-file-missing'
  | 'routes-export-missing'
  | 'route-map-invalid'
  | 'route-module-import-failed'
  | 'route-map-invalid-json'
  | 'route-map-loader-signal'
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
  reason?: string
  status: DoctorSuiteStatus
}

export interface DoctorReport {
  appRoot?: string
  findings: DoctorFinding[]
  routesFile?: string
  suites: DoctorSuiteResult[]
}

export function createDoctorSuite(
  name: DoctorSuiteName,
  findings: DoctorFinding[],
): DoctorSuiteResult {
  return {
    findings,
    name,
    status: findings.length === 0 ? 'ok' : 'issues',
  }
}

export function createSkippedDoctorSuite(name: DoctorSuiteName, reason: string): DoctorSuiteResult {
  return {
    findings: [],
    name,
    reason,
    status: 'skipped',
  }
}
