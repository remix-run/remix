import * as fs from 'node:fs';
import * as path from 'node:path';
const packageTypeCache = new Map();
export function getModuleFormat(filePath, source) {
    let packageJsonPath = findNearestPackageJson(filePath);
    if (packageJsonPath == null) {
        return source != null && hasModuleSyntax(source) ? 'module' : 'commonjs';
    }
    let cachedPackageType = packageTypeCache.get(packageJsonPath);
    if (cachedPackageType != null) {
        return cachedPackageType;
    }
    let packageType = readPackageType(packageJsonPath);
    packageTypeCache.set(packageJsonPath, packageType);
    return packageType;
}
function findNearestPackageJson(filePath) {
    let directory = path.dirname(filePath);
    while (true) {
        let packageJsonPath = path.join(directory, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return packageJsonPath;
        }
        let parentDirectory = path.dirname(directory);
        if (parentDirectory === directory) {
            return null;
        }
        directory = parentDirectory;
    }
}
function readPackageType(packageJsonPath) {
    try {
        let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (!isRecord(packageJson)) {
            throw new Error(`Invalid package.json at ${packageJsonPath}. Expected an object.`);
        }
        return packageJson.type === 'module' ? 'module' : 'commonjs';
    }
    catch (error) {
        let nodeError = error;
        if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
            return 'commonjs';
        }
        throw error;
    }
}
function hasModuleSyntax(source) {
    if (/\bimport\.meta\b/.test(source)) {
        return true;
    }
    let depth = 0;
    for (let line of source.split(/\r?\n/)) {
        let trimmed = line.trimStart();
        if (depth === 0 && isModuleSyntaxLine(trimmed)) {
            return true;
        }
        depth = Math.max(0, depth + getBraceDelta(line));
    }
    return false;
}
function isModuleSyntaxLine(line) {
    return (/^import\s+(?!type\b)(?:[\w*{]|\S+\s+from\s+|['"])/.test(line) ||
        /^export\s+(?!(?:declare|interface|type)\b)/.test(line) ||
        /^await\b/.test(line) ||
        /^(?:const|let|class)\s+(?:require|exports|module|__filename|__dirname)\b/.test(line));
}
function getBraceDelta(line) {
    let delta = 0;
    for (let char of line) {
        if (char === '{')
            delta += 1;
        if (char === '}')
            delta -= 1;
    }
    return delta;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
