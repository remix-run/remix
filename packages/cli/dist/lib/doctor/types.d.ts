export type DoctorSuiteName = 'environment' | 'project' | 'controllers';
export type DoctorFindingSeverity = 'warn' | 'advice';
export type DoctorSuiteStatus = 'ok' | 'issues' | 'skipped';
export type DoctorFindingCode = 'project-root-not-found' | 'package-json-read-failed' | 'package-json-invalid' | 'node-engine-missing' | 'node-engine-unparseable' | 'node-version-unsupported' | 'remix-dependency-missing' | 'remix-install-missing' | 'routes-file-missing' | 'routes-export-missing' | 'route-map-invalid' | 'route-module-import-failed' | 'route-map-invalid-json' | 'route-map-loader-signal' | 'missing-owner' | 'wrong-owner-kind' | 'ambiguous-owner' | 'duplicate-owner-file' | 'incomplete-controller' | 'promotion-drift' | 'orphan-action' | 'orphan-controller' | 'orphan-route-directory';
export type DoctorFixKind = 'create-directory' | 'create-file' | 'update-file';
export interface DoctorFinding {
    actualPath?: string;
    code: DoctorFindingCode;
    expectedPath?: string;
    fixable?: boolean;
    message: string;
    routeName?: string;
    severity: DoctorFindingSeverity;
    suite: DoctorSuiteName;
}
export interface DoctorFixPlan {
    code: DoctorFindingCode;
    contents?: string;
    kind: DoctorFixKind;
    path: string;
    routeName?: string;
    suite: DoctorSuiteName;
}
export interface DoctorAppliedFix {
    code: DoctorFindingCode;
    kind: DoctorFixKind;
    path: string;
    routeName?: string;
    suite: DoctorSuiteName;
}
export interface DoctorSuiteResult {
    appliedFixes?: DoctorAppliedFix[];
    findings: DoctorFinding[];
    name: DoctorSuiteName;
    reason?: string;
    status: DoctorSuiteStatus;
}
export interface DoctorReport {
    appliedFixes?: DoctorAppliedFix[];
    appRoot?: string;
    findings: DoctorFinding[];
    remainingFindings?: DoctorFinding[];
    routesFile?: string;
    suites: DoctorSuiteResult[];
}
export declare function createDoctorSuite(name: DoctorSuiteName, findings: DoctorFinding[]): DoctorSuiteResult;
export declare function createSkippedDoctorSuite(name: DoctorSuiteName, reason: string): DoctorSuiteResult;
//# sourceMappingURL=types.d.ts.map