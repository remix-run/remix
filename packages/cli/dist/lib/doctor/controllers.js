import { inspectControllerOwnership } from "../controller-ownership.js";
import { getControllerFindings } from "./controller-findings.js";
import { getControllerFixPlans } from "./controller-fix-plans.js";
import { createDoctorSuite } from "./types.js";
export async function checkControllerConventions(appRoot, tree) {
    let ownership = await inspectControllerOwnership(appRoot, tree);
    let fixPlans = await getControllerFixPlans(appRoot, tree, ownership);
    let findings = getControllerFindings(ownership, fixPlans);
    return {
        fixPlans,
        suite: createDoctorSuite('actions', findings),
    };
}
