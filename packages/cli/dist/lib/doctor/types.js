export function hasWarningFindings(findings) {
    return findings.some((finding) => finding.severity === 'warn');
}
export function createDoctorSuite(name, findings) {
    return {
        findings,
        name,
        status: hasWarningFindings(findings) ? 'issues' : 'ok',
    };
}
export function createSkippedDoctorSuite(name, reason) {
    return {
        findings: [],
        name,
        reason,
        status: 'skipped',
    };
}
