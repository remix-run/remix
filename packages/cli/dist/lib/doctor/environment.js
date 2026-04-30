import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { createRequire } from 'node:module';
import * as semver from 'semver';
import { MINIMUM_SUPPORTED_NODE_VERSION } from "../bootstrap-project.js";
import { createDoctorSuite, } from "./types.js";
export async function checkEnvironment(cwd = process.cwd()) {
    let projectRoot = await findNearestPackageRoot(cwd);
    if (projectRoot == null) {
        return {
            suite: createDoctorSuite('environment', [
                {
                    code: 'project-root-not-found',
                    message: 'Could not find package.json. Run this command inside a Remix project.',
                    severity: 'warn',
                    suite: 'environment',
                },
            ]),
        };
    }
    let packageJsonPath = path.join(projectRoot, 'package.json');
    let packageJson = await readPackageJson(packageJsonPath);
    if ('suite' in packageJson) {
        return {
            projectRoot,
            suite: packageJson.suite,
        };
    }
    let findings = [];
    let nodeRequirement = packageJson.engines?.node;
    if (nodeRequirement == null) {
        findings.push({
            actualPath: 'package.json',
            code: 'node-engine-missing',
            fixable: true,
            message: 'package.json does not declare engines.node. Add one to document the supported Node.js version.',
            severity: 'advice',
            suite: 'environment',
        });
    }
    else {
        let nodeSupport = satisfiesNodeRange(process.version, nodeRequirement);
        if (nodeSupport == null) {
            findings.push({
                actualPath: 'package.json',
                code: 'node-engine-unparseable',
                fixable: true,
                message: `Could not evaluate engines.node "${nodeRequirement}" automatically.`,
                severity: 'advice',
                suite: 'environment',
            });
        }
        else if (!nodeSupport) {
            findings.push({
                actualPath: 'package.json',
                code: 'node-version-unsupported',
                fixable: true,
                message: `Project requires Node.js ${nodeRequirement}, but the current runtime is ${process.version}.`,
                severity: 'warn',
                suite: 'environment',
            });
        }
    }
    if (!hasRemixDependency(packageJson)) {
        findings.push({
            actualPath: 'package.json',
            code: 'remix-dependency-missing',
            fixable: true,
            message: 'package.json does not declare a remix dependency.',
            severity: 'warn',
            suite: 'environment',
        });
    }
    if (!(await canResolveRemix(projectRoot))) {
        findings.push({
            actualPath: 'package.json',
            code: 'remix-install-missing',
            message: 'Could not resolve remix from this project. Install dependencies and try again.',
            severity: 'warn',
            suite: 'environment',
        });
    }
    return {
        packageJson,
        packageJsonPath,
        projectRoot,
        suite: createDoctorSuite('environment', findings),
    };
}
export function getEnvironmentFixPlans(result, remixVersion) {
    if (result.projectRoot == null || result.packageJson == null || result.packageJsonPath == null) {
        return [];
    }
    let packageJson = structuredClone(result.packageJson);
    let code = getEnvironmentFixCode(result.suite.findings);
    let changed = false;
    if (result.suite.findings.some((finding) => finding.code === 'node-engine-missing' ||
        finding.code === 'node-engine-unparseable' ||
        finding.code === 'node-version-unsupported')) {
        packageJson.engines = {
            ...packageJson.engines,
            node: `>=${MINIMUM_SUPPORTED_NODE_VERSION}`,
        };
        changed = true;
    }
    if (result.suite.findings.some((finding) => finding.code === 'remix-dependency-missing')) {
        packageJson.dependencies = {
            ...packageJson.dependencies,
            remix: remixVersion ?? 'latest',
        };
        changed = true;
    }
    if (!changed || code == null) {
        return [];
    }
    return [
        {
            code,
            contents: `${JSON.stringify(packageJson, null, 2)}\n`,
            kind: 'update-file',
            path: 'package.json',
            suite: 'environment',
        },
    ];
}
async function findNearestPackageRoot(startDir) {
    let currentDir = path.resolve(startDir);
    while (true) {
        if (await pathExists(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }
        let parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return null;
        }
        currentDir = parentDir;
    }
}
async function readPackageJson(packageJsonPath) {
    let source;
    try {
        source = await fs.readFile(packageJsonPath, 'utf8');
    }
    catch (error) {
        let nodeError = error;
        let detail = nodeError.code == null
            ? 'Could not read package.json.'
            : `Could not read package.json (${nodeError.code}).`;
        return {
            suite: createDoctorSuite('environment', [
                {
                    actualPath: 'package.json',
                    code: 'package-json-read-failed',
                    message: detail,
                    severity: 'warn',
                    suite: 'environment',
                },
            ]),
        };
    }
    try {
        return JSON.parse(source);
    }
    catch {
        return {
            suite: createDoctorSuite('environment', [
                {
                    actualPath: 'package.json',
                    code: 'package-json-invalid',
                    message: 'package.json is not valid JSON.',
                    severity: 'warn',
                    suite: 'environment',
                },
            ]),
        };
    }
}
function hasRemixDependency(packageJson) {
    return packageJson.dependencies?.remix != null || packageJson.devDependencies?.remix != null;
}
function getEnvironmentFixCode(findings) {
    let fixableFinding = findings.find((finding) => finding.code === 'node-engine-missing' ||
        finding.code === 'node-engine-unparseable' ||
        finding.code === 'node-version-unsupported' ||
        finding.code === 'remix-dependency-missing');
    return fixableFinding?.code ?? null;
}
async function canResolveRemix(projectRoot) {
    if (!(await pathExists(path.join(projectRoot, 'node_modules', 'remix', 'package.json')))) {
        return false;
    }
    try {
        let require = createRequire(path.join(projectRoot, 'package.json'));
        require.resolve('remix/package.json');
        return true;
    }
    catch {
        return false;
    }
}
function satisfiesNodeRange(version, range) {
    let parsedVersion = semver.valid(version);
    let trimmedRange = range.trim();
    if (parsedVersion == null || trimmedRange === '') {
        return null;
    }
    let parsedRange = semver.validRange(trimmedRange);
    if (parsedRange == null) {
        return null;
    }
    return semver.satisfies(parsedVersion, parsedRange);
}
async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch (error) {
        let nodeError = error;
        if (nodeError.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}
