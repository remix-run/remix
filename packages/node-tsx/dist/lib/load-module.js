var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { register } from 'node:module';
import * as path from 'node:path';
import * as process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createLoadModuleSpecifier } from "./loader.js";
export async function loadModule(specifier, parent) {
    let namespace = `remix-node-tsx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let parentURL = toParentURL(parent);
    let resolvedSpecifier = path.isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier;
    let loadModuleURL = new URL(import.meta.url);
    let registerHooksURL = new URL(loadModuleURL.pathname.endsWith('.ts') ? './register-hooks.ts' : './register-hooks.js', loadModuleURL);
    registerHooksURL.searchParams.set('namespace', namespace);
    process.setSourceMapsEnabled(true);
    register(registerHooksURL, {
        data: { namespace },
        parentURL: import.meta.url,
    });
    return import(__rewriteRelativeImportExtension(createLoadModuleSpecifier(resolvedSpecifier, parentURL, namespace)));
}
function toParentURL(parent) {
    if (parent instanceof URL) {
        return parent.href;
    }
    if (URL.canParse(parent)) {
        return new URL(parent).href;
    }
    return pathToFileURL(parent).href;
}
