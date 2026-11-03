import { inspectControllerOwnership } from '../controller-ownership.js';
import { getControllerFindings } from './controller-findings.js';
import { createDoctorSuite } from './types.js';
export async function checkControllerConventions(appRoot, tree) {
    let ownership = await inspectControllerOwnership(appRoot, tree);
    let findings = getControllerFindings(ownership);
    return {
        suite: createDoctorSuite('actions', findings),
    };
}
