import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getFilePathDirectory, normalizeFilePath } from "./paths.js";
const injectedPackageNames = ['@oxc-project/runtime'];
const injectedPackagesBasePath = '/__@remix/injected';
const resolvedInjectedPackages = new Map();
export function isInjectedPackageFilePath(filePath) {
    let normalizedFilePath = normalizeFilePath(filePath);
    for (let packageName of injectedPackageNames) {
        let packageRoot = getResolvedInjectedPackage(packageName).packageRoot;
        if (normalizedFilePath === packageRoot || normalizedFilePath.startsWith(`${packageRoot}/`)) {
            return true;
        }
    }
    return false;
}
export function getInjectedPackageRouteConfigs() {
    return injectedPackageNames.map((packageName) => {
        let { packageRoot } = getResolvedInjectedPackage(packageName);
        return {
            fileMap: {
                [getInjectedPackageRoutePattern(packageName)]: `${packageName}/*path`,
            },
            rootDir: getInjectedPackageRouteRoot(packageRoot, packageName),
        };
    });
}
export function getInjectedPackageNameForSpecifier(specifier) {
    for (let packageName of injectedPackageNames) {
        if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
            return packageName;
        }
    }
    return null;
}
export function mayContainInjectedPackageSpecifier(sourceText) {
    return injectedPackageNames.some((packageName) => sourceText.includes(packageName));
}
export function maskAuthoredInjectedPackageSpecifier(specifier) {
    let packageName = getInjectedPackageNameForSpecifier(specifier);
    if (!packageName)
        return null;
    let maskedPackageName = getMaskedInjectedPackageName(packageName);
    return `${maskedPackageName}${specifier.slice(packageName.length)}`;
}
export function restoreAuthoredInjectedPackageSpecifier(specifier) {
    for (let packageName of injectedPackageNames) {
        let maskedPackageName = getMaskedInjectedPackageName(packageName);
        if (specifier === maskedPackageName) {
            return packageName;
        }
        if (specifier.startsWith(`${maskedPackageName}/`)) {
            return `${packageName}${specifier.slice(maskedPackageName.length)}`;
        }
    }
    return null;
}
function getMaskedInjectedPackageName(packageName) {
    return `~${packageName.slice(1)}`;
}
export function getInjectedPackageImporterPath() {
    return normalizeFilePath(fileURLToPath(import.meta.url));
}
function getResolvedInjectedPackage(packageName) {
    let existing = resolvedInjectedPackages.get(packageName);
    if (existing)
        return existing;
    let packageJsonUrl = import.meta.resolve(`${packageName}/package.json`);
    let packageJsonPath = normalizeFilePath(fs.realpathSync(fileURLToPath(packageJsonUrl)));
    let resolvedInjectedPackage = {
        packageJsonPath,
        packageRoot: normalizeFilePath(fs.realpathSync(getFilePathDirectory(packageJsonPath))),
    };
    resolvedInjectedPackages.set(packageName, resolvedInjectedPackage);
    return resolvedInjectedPackage;
}
function getInjectedPackageRoutePattern(packageName) {
    return `${injectedPackagesBasePath}/${packageName}/*path`;
}
function getInjectedPackageRouteRoot(packageRoot, packageName) {
    let routeRoot = packageRoot;
    for (let _segment of packageName.split('/')) {
        routeRoot = getFilePathDirectory(routeRoot);
    }
    return routeRoot;
}
