import { supportedScriptExtensions } from "../scripts/resolve.js";
export function defineFileTransform(transform) {
    return transform;
}
const reservedFileExtensions = new Set([...supportedScriptExtensions, '.css', '.map']);
const defaultMaxRequestTransforms = 5;
export function normalizeFilesOptions(files) {
    if (files == null) {
        return {
            extensions: [],
            globalTransforms: [],
            hasTransforms: false,
            maxRequestTransforms: defaultMaxRequestTransforms,
            transforms: {},
        };
    }
    if (!Array.isArray(files.extensions)) {
        throw new TypeError('files.extensions must be an array');
    }
    let normalizedExtensions = [];
    let seen = new Set();
    for (let extension of files.extensions) {
        if (typeof extension !== 'string') {
            throw new TypeError('files.extensions values must be strings');
        }
        let normalizedExtension = extension.trim().toLowerCase();
        if (!/^\.[A-Za-z0-9_-]+$/.test(normalizedExtension)) {
            throw new TypeError(`files.extensions values must use ".ext" format. Received "${extension}".`);
        }
        if (reservedFileExtensions.has(normalizedExtension)) {
            throw new TypeError(`files.extensions cannot include compiled asset extensions like "${normalizedExtension}".`);
        }
        if (seen.has(normalizedExtension))
            continue;
        seen.add(normalizedExtension);
        normalizedExtensions.push(normalizedExtension);
    }
    let transforms = files.transforms ?? {};
    if (transforms === null || typeof transforms !== 'object' || Array.isArray(transforms)) {
        throw new TypeError('files.transforms must be an object');
    }
    let normalizedTransformsEntries = [];
    for (let [name, transform] of Object.entries(transforms)) {
        if (!/^[A-Za-z0-9_-]+$/.test(name)) {
            throw new TypeError(`files.transforms keys must use "transform-name" format. Received "${name}".`);
        }
        if (transform === null ||
            typeof transform !== 'object' ||
            typeof transform.transform !== 'function') {
            throw new TypeError(`files.transforms.${name} must define a transform() function`);
        }
        if ('param' in transform &&
            transform.param !== undefined &&
            transform.param !== true &&
            transform.param !== 'optional') {
            throw new TypeError(`files.transforms.${name}.param must be true or "optional"`);
        }
        normalizedTransformsEntries.push([
            name,
            {
                ...transform,
                extensions: normalizeTransformExtensions(transform.extensions, `files.transforms.${name}.extensions`),
            },
        ]);
    }
    let normalizedTransforms = Object.fromEntries(normalizedTransformsEntries);
    let globalTransforms = files.globalTransforms ?? [];
    if (!Array.isArray(globalTransforms)) {
        throw new TypeError('files.globalTransforms must be an array');
    }
    let normalizedGlobalTransforms = [];
    for (let [index, transform] of globalTransforms.entries()) {
        if (typeof transform === 'function') {
            normalizedGlobalTransforms.push({ transform });
            continue;
        }
        if (transform === null || typeof transform !== 'object') {
            throw new TypeError(`files.globalTransforms[${index}] must be a function or object`);
        }
        if ('name' in transform && transform.name !== undefined && typeof transform.name !== 'string') {
            throw new TypeError(`files.globalTransforms[${index}].name must be a string`);
        }
        if (typeof transform.transform !== 'function') {
            throw new TypeError(`files.globalTransforms[${index}] must define a transform() function`);
        }
        normalizedGlobalTransforms.push({
            ...transform,
            extensions: normalizeTransformExtensions(transform.extensions, `files.globalTransforms[${index}].extensions`),
        });
    }
    let maxRequestTransforms = files.maxRequestTransforms ?? defaultMaxRequestTransforms;
    if (!Number.isInteger(maxRequestTransforms) || maxRequestTransforms < 1) {
        throw new TypeError('files.maxRequestTransforms must be a positive integer');
    }
    if (files.cache !== undefined) {
        if (files.cache === null ||
            typeof files.cache !== 'object' ||
            typeof files.cache.get !== 'function' ||
            typeof files.cache.set !== 'function') {
            throw new TypeError('files.cache must implement the FileStorage interface');
        }
    }
    return {
        cache: files.cache,
        extensions: normalizedExtensions,
        globalTransforms: normalizedGlobalTransforms,
        hasTransforms: Object.keys(normalizedTransforms).length > 0 || normalizedGlobalTransforms.length > 0,
        maxRequestTransforms,
        transforms: normalizedTransforms,
    };
}
function normalizeTransformExtensions(extensions, optionPath) {
    if (extensions === undefined)
        return undefined;
    if (!Array.isArray(extensions)) {
        throw new TypeError(`${optionPath} must be an array`);
    }
    if (extensions.length === 0) {
        throw new TypeError(`${optionPath} must include at least one extension`);
    }
    let normalizedExtensions = [];
    let seen = new Set();
    for (let extension of extensions) {
        if (typeof extension !== 'string') {
            throw new TypeError(`${optionPath} values must be strings`);
        }
        let normalizedExtension = extension.trim().toLowerCase();
        if (!/^\.[A-Za-z0-9_-]+$/.test(normalizedExtension)) {
            throw new TypeError(`${optionPath} values must use ".ext" format. Received "${extension}".`);
        }
        if (seen.has(normalizedExtension))
            continue;
        seen.add(normalizedExtension);
        normalizedExtensions.push(normalizedExtension);
    }
    return normalizedExtensions;
}
export function serializeAssetTransformInvocations(transforms, transformsByName, maxTransforms = defaultMaxRequestTransforms) {
    if (transforms.length > maxTransforms) {
        throw new TypeError(`Expected at most ${maxTransforms} request transforms`);
    }
    return transforms.map((transformInvocation) => normalizeAssetTransformInvocation(transformInvocation, transformsByName, (message) => {
        throw new TypeError(message);
    }));
}
export function parseAssetTransformInvocations(transformsQuery, transformsByName, maxTransforms = defaultMaxRequestTransforms) {
    if (transformsQuery.length > maxTransforms) {
        throw new TypeError(`Expected at most ${maxTransforms} request transforms`);
    }
    return transformsQuery.map((transformQuery) => parseSerializedAssetTransformInvocation(transformQuery, transformsByName, (message) => {
        throw new TypeError(message);
    }));
}
function normalizeAssetTransformInvocation(transformInvocation, transformsByName, onError) {
    if (typeof transformInvocation === 'string') {
        if (!/^[A-Za-z0-9_-]+$/.test(transformInvocation)) {
            return onError('Expected each transform name to use "transform-name" format');
        }
        let transform = transformsByName[transformInvocation];
        if (!transform) {
            return onError(`Unknown file transform "${transformInvocation}"`);
        }
        if (transform.param === true) {
            return onError(`File transform "${transformInvocation}" requires a param`);
        }
        return transformInvocation;
    }
    if (!Array.isArray(transformInvocation)) {
        return onError('Expected each transform to be a string name or tuple');
    }
    if (transformInvocation.length === 0 || transformInvocation.length > 2) {
        return onError('Expected each transform tuple to have one or two items');
    }
    let [name, rawParam] = transformInvocation;
    if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(name)) {
        return onError('Expected each transform name to use "transform-name" format');
    }
    let transform = transformsByName[name];
    if (!transform) {
        return onError(`Unknown file transform "${name}"`);
    }
    if (transformInvocation.length === 1) {
        if (transform.param === true) {
            return onError(`File transform "${name}" requires a param`);
        }
        return name;
    }
    if (typeof rawParam !== 'string') {
        return onError(`Invalid param for file transform "${name}": expected a string`);
    }
    if (transform.param === undefined) {
        if (transformInvocation.length === 2) {
            return onError(`File transform "${name}" does not accept a param`);
        }
        return name;
    }
    return `${name}:${rawParam}`;
}
function parseSerializedAssetTransformInvocation(transformQuery, transformsByName, onError) {
    let separatorIndex = transformQuery.indexOf(':');
    let name = separatorIndex === -1 ? transformQuery : transformQuery.slice(0, separatorIndex);
    let param = separatorIndex === -1 ? undefined : transformQuery.slice(separatorIndex + 1);
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
        return onError('Expected each transform name to use "transform-name" format');
    }
    let transform = transformsByName[name];
    if (!transform) {
        return onError(`Unknown file transform "${name}"`);
    }
    if (transform.param === undefined) {
        if (param !== undefined) {
            return onError(`File transform "${name}" does not accept a param`);
        }
        return name;
    }
    if (transform.param === true && param === undefined) {
        return onError(`File transform "${name}" requires a param`);
    }
    if (param === undefined) {
        return name;
    }
    return [name, param];
}
