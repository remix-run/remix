import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveContainedPath } from "../contained-path.js";
export async function applyDoctorFixPlans(appRoot, fixPlans) {
    let appliedFixes = [];
    for (let fixPlan of dedupeDoctorFixPlans(fixPlans)) {
        let absolutePath = resolveDoctorFixPath(appRoot, fixPlan.path);
        if (fixPlan.kind === 'create-directory') {
            await fs.mkdir(absolutePath, { recursive: true });
            appliedFixes.push(toAppliedDoctorFix(fixPlan));
            continue;
        }
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        if (fixPlan.kind === 'update-file') {
            await fs.writeFile(absolutePath, fixPlan.contents ?? '', { encoding: 'utf8' });
            appliedFixes.push(toAppliedDoctorFix(fixPlan));
            continue;
        }
        try {
            await fs.writeFile(absolutePath, fixPlan.contents ?? '', { encoding: 'utf8', flag: 'wx' });
        }
        catch (error) {
            let nodeError = error;
            if (nodeError.code !== 'EEXIST') {
                throw error;
            }
            continue;
        }
        appliedFixes.push(toAppliedDoctorFix(fixPlan));
    }
    return appliedFixes;
}
function dedupeDoctorFixPlans(fixPlans) {
    let seen = new Set();
    let uniqueFixPlans = [];
    for (let fixPlan of fixPlans) {
        let key = `${fixPlan.kind}:${fixPlan.path}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        uniqueFixPlans.push(fixPlan);
    }
    return uniqueFixPlans;
}
function toAppliedDoctorFix(fixPlan) {
    return {
        code: fixPlan.code,
        kind: fixPlan.kind,
        path: fixPlan.path,
        routeName: fixPlan.routeName,
        suite: fixPlan.suite,
    };
}
function resolveDoctorFixPath(appRoot, fixPath) {
    try {
        return resolveContainedPath(appRoot, fixPath);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('escapes the allowed root')) {
            throw new Error(`Doctor fix path resolves outside the app root: ${fixPath}`);
        }
        throw error;
    }
}
