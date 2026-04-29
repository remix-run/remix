export function createDoctorSuite(name, findings) {
    return {
        findings,
        name,
        status: findings.some((finding) => finding.severity === 'warn') ? 'issues' : 'ok',
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
