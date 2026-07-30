import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveContainedPath } from "../contained-path.js";
export async function applyDoctorFixPlans(appRoot, fixPlans) {
    let appliedFixes = [];
    for (let fixPlan of dedupeDoctorFixPlans(fixPlans)) {
        let absolutePath = await resolveDoctorFixPath(appRoot, fixPlan.path);
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
            if (!isErrorWithCode(error, 'EEXIST')) {
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
async function resolveDoctorFixPath(appRoot, fixPath) {
    let absolutePath;
    try {
        absolutePath = resolveContainedPath(appRoot, fixPath);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('escapes the allowed root')) {
            throwDoctorFixPathOutsideRoot(fixPath);
        }
        throw error;
    }
    let rootPath = path.resolve(appRoot);
    let rootRealPath = await fs.realpath(rootPath);
    let relativePath = path.relative(rootPath, absolutePath);
    let pathParts = relativePath === '' ? [] : relativePath.split(path.sep);
    let currentPath = rootPath;
    let currentRealPath = rootRealPath;
    for (let [index, pathPart] of pathParts.entries()) {
        currentPath = path.join(currentPath, pathPart);
        let stats = await lstatIfExists(currentPath);
        if (stats == null) {
            return path.join(currentRealPath, ...pathParts.slice(index));
        }
        currentRealPath = await fs.realpath(currentPath);
        if (!isPathInsideRoot(rootRealPath, currentRealPath)) {
            throwDoctorFixPathOutsideRoot(fixPath);
        }
    }
    return currentRealPath;
}
async function lstatIfExists(filePath) {
    try {
        return await fs.lstat(filePath);
    }
    catch (error) {
        if (isErrorWithCode(error, 'ENOENT')) {
            return null;
        }
        throw error;
    }
}
function isPathInsideRoot(rootPath, filePath) {
    let relativePath = path.relative(rootPath, filePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
function isErrorWithCode(error, code) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
function throwDoctorFixPathOutsideRoot(fixPath) {
    throw new Error(`Doctor fix path resolves outside the app root: ${fixPath}`);
}
