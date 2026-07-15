import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getFilePathDirectory, normalizeFilePath } from "./paths.js";
const injectedPackageNames = ['@oxc-project/runtime'];
const authoredInjectedPackageNames = ['@oxc-project/runtime'];
const generatedInjectedPackageSpecifiers = [];
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
        let { filePattern, routeRoot } = getInjectedPackageRoute(packageRoot, packageName);
        return {
            fileMap: {
                [getInjectedPackageRoutePattern(packageName)]: filePattern,
            },
            rootDir: routeRoot,
        };
    });
}
export function getInjectedPackageNameForSpecifier(specifier) {
    for (let injectedSpecifier of generatedInjectedPackageSpecifiers) {
        if (specifier === injectedSpecifier) {
            return getPackageName(injectedSpecifier);
        }
    }
    for (let packageName of authoredInjectedPackageNames) {
        if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
            return packageName;
        }
    }
    return null;
}
export function mayContainInjectedPackageSpecifier(sourceText) {
    return authoredInjectedPackageNames.some((packageName) => sourceText.includes(packageName));
}
export function maskAuthoredInjectedPackageSpecifier(specifier) {
    for (let packageName of authoredInjectedPackageNames) {
        if (specifier !== packageName && !specifier.startsWith(`${packageName}/`))
            continue;
        let maskedPackageName = getMaskedInjectedPackageName(packageName);
        return `${maskedPackageName}${specifier.slice(packageName.length)}`;
    }
    return null;
}
export function restoreAuthoredInjectedPackageSpecifier(specifier) {
    for (let packageName of authoredInjectedPackageNames) {
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
function getPackageName(specifier) {
    let parts = specifier.split('/');
    return parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1]}` : (parts[0] ?? specifier);
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
function getInjectedPackageRoute(packageRoot, packageName) {
    if (!packageRoot.endsWith(`/${packageName}`)) {
        return {
            filePattern: `${packageRoot.slice(getFilePathDirectory(packageRoot).length + 1)}/*path`,
            routeRoot: getFilePathDirectory(packageRoot),
        };
    }
    let routeRoot = packageRoot;
    for (let _segment of packageName.split('/')) {
        routeRoot = getFilePathDirectory(routeRoot);
    }
    return {
        filePattern: `${packageName}/*path`,
        routeRoot,
    };
}
