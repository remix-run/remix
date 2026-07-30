import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getModuleFormat } from "./package-type.js";
import { appendNamespaceToUrl, getNamespace, parseScopedSpecifier } from "./request.js";
import { transformModule } from "./transform.js";
const scopedState = {};
export function initialize(data) {
    scopedState.namespace = data?.namespace;
}
export async function load(url, context, nextLoad) {
    let namespace = scopedState.namespace;
    if (namespace != null && getNamespace(url) !== namespace) {
        return nextLoad(url, context);
    }
    if (url.startsWith('file:')) {
        let filePath = fileURLToPath(url);
        if (isTransformableFile(filePath)) {
            let source = await fs.readFile(filePath, 'utf8');
            return {
                format: getModuleFormat(filePath, source),
                shortCircuit: true,
                source: transformModule(filePath, source),
            };
        }
    }
    return nextLoad(url, context);
}
export async function resolve(specifier, context, nextResolve) {
    let namespace = scopedState.namespace;
    if (namespace == null) {
        return await nextResolve(specifier, context);
    }
    let scopedRequest = parseScopedSpecifier(specifier);
    let requestNamespace = scopedRequest?.namespace ?? getNamespace(specifier) ?? getNamespace(context.parentURL);
    if (requestNamespace !== namespace) {
        return await nextResolve(specifier, context);
    }
    let resolved = await nextResolve(scopedRequest?.specifier ?? specifier, {
        ...context,
        parentURL: scopedRequest?.parentURL ?? context.parentURL,
    });
    if (resolved.format === 'builtin' || !resolved.url.startsWith('file:')) {
        return resolved;
    }
    return {
        ...resolved,
        url: appendNamespaceToUrl(resolved.url, namespace),
    };
}
function isTransformableFile(filePath) {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
}
