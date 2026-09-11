const browserTargetNames = [
    'chrome',
    'edge',
    'firefox',
    'ie',
    'ios',
    'opera',
    'safari',
    'samsung',
];
const browserTargetNameSet = new Set(browserTargetNames);
const lightningCssTargetNameByBrowserTargetName = {
    chrome: 'chrome',
    edge: 'edge',
    firefox: 'firefox',
    ie: 'ie',
    ios: 'ios_saf',
    opera: 'opera',
    safari: 'safari',
    samsung: 'samsung',
};
export function resolveScriptTarget(target) {
    let resolvedTarget = normalizeScriptTargetObject(target, 'target');
    if (!resolvedTarget)
        return undefined;
    let oxcTarget = [];
    if (resolvedTarget.es) {
        oxcTarget.push(resolvedTarget.es);
    }
    for (let browserTargetName of browserTargetNames) {
        let version = resolvedTarget[browserTargetName];
        if (version == null)
            continue;
        oxcTarget.push(`${browserTargetName}${version}`);
    }
    return oxcTarget;
}
export function resolveStyleTarget(target) {
    let resolvedTarget = normalizeStyleTargetObject(target, 'target');
    if (!resolvedTarget)
        return undefined;
    let lightningCssTargets = {};
    for (let browserTargetName of browserTargetNames) {
        let version = resolvedTarget[browserTargetName];
        if (version == null)
            continue;
        lightningCssTargets[lightningCssTargetNameByBrowserTargetName[browserTargetName]] =
            toLightningCssTargetVersion(version);
    }
    return lightningCssTargets;
}
function normalizeScriptTargetObject(target, optionPath) {
    if (target == null)
        return undefined;
    if (!isPlainObject(target)) {
        throw new TypeError(`${optionPath} must be an object`);
    }
    let normalizedTarget = {};
    for (let [key, value] of Object.entries(target)) {
        if (key === 'es') {
            normalizedTarget.es = normalizeScriptTargetVersion(value, `${optionPath}.es`);
            continue;
        }
        if (!browserTargetNameSet.has(key)) {
            throw new TypeError(`${optionPath}.${key} is not a supported target`);
        }
        normalizedTarget[key] = normalizeBrowserTargetVersion(value, `${optionPath}.${key}`);
    }
    return Object.keys(normalizedTarget).length === 0 ? undefined : normalizedTarget;
}
function normalizeStyleTargetObject(target, optionPath) {
    if (target == null)
        return undefined;
    if (!isPlainObject(target)) {
        throw new TypeError(`${optionPath} must be an object`);
    }
    let normalizedTarget = {};
    for (let [key, value] of Object.entries(target)) {
        if (key === 'es') {
            continue;
        }
        if (!browserTargetNameSet.has(key)) {
            throw new TypeError(`${optionPath}.${key} is not a supported target`);
        }
        normalizedTarget[key] = normalizeBrowserTargetVersion(value, `${optionPath}.${key}`);
    }
    return Object.keys(normalizedTarget).length === 0 ? undefined : normalizedTarget;
}
function normalizeScriptTargetVersion(value, optionPath) {
    if (typeof value !== 'string') {
        throw new TypeError(`${optionPath} must be a string`);
    }
    let normalizedValue = value.trim();
    if (normalizedValue.length === 0) {
        throw new TypeError(`${optionPath} must be a non-empty string`);
    }
    if (!/^\d+$/.test(normalizedValue)) {
        throw new TypeError(`${optionPath} must use a single numeric year like "2020"`);
    }
    if (!/^\d{4}$/.test(normalizedValue) || Number(normalizedValue) < 2015) {
        throw new TypeError(`${optionPath} must use a four-digit year of 2015 or higher`);
    }
    return `es${normalizedValue}`;
}
function normalizeBrowserTargetVersion(value, optionPath) {
    if (typeof value !== 'string') {
        throw new TypeError(`${optionPath} must be a string`);
    }
    if (value.trim().length === 0) {
        throw new TypeError(`${optionPath} must be a non-empty string`);
    }
    if (!/^\d+(\.\d+){0,2}$/.test(value)) {
        throw new TypeError(`${optionPath} must use "X", "X.Y", or "X.Y.Z" version format`);
    }
    let segments = value.split('.').map(Number);
    if (segments.some((segment) => segment > 255)) {
        throw new TypeError(`${optionPath} must use version components between 0 and 255`);
    }
    return value;
}
function toLightningCssTargetVersion(version) {
    let [major, minor = 0, patch = 0] = version.split('.').map(Number);
    return major * 65536 + minor * 256 + patch;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
