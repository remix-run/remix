var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { featureDetectionPromise, supportsMultipleImportMaps } from './features.js';
import { resolveModuleUrl } from './native-resolve.js';
let runtimePromise;
const multipleImportMapSupportPromise = featureDetectionPromise.then(() => {
    let supported = supportsMultipleImportMaps;
    // A later import observes the cached rejection; the background warm-up must not be unhandled.
    if (!supported && typeof document !== 'undefined')
        void getRuntime().catch(() => { });
    return supported;
});
/**
 * Detects whether the current document can install multiple import maps.
 *
 * Returns `true` only when an isolated feature test verifies support. If the test cannot run or
 * complete under the document's Content Security Policy, this returns `false`. When the polyfill
 * is required, its runtime begins loading in the background.
 *
 * @returns Whether multiple import map support was verified.
 */
export function detectMultipleImportMapSupport() {
    return multipleImportMapSupportPromise;
}
/**
 * Loads a JavaScript module, using the multiple import map polyfill when required.
 *
 * @param specifier Module specifier to load.
 * @param parentUrl URL to resolve the specifier from. (default: `document.baseURI`)
 * @returns The loaded module namespace.
 */
export async function importModule(specifier, parentUrl = document.baseURI) {
    if (await detectMultipleImportMapSupport())
        return import(__rewriteRelativeImportExtension(resolveModuleUrl(specifier, parentUrl)));
    return importShim(specifier, parentUrl);
}
/**
 * Loads a JavaScript module through the polyfill using every import map currently installed in the
 * document. This function does not detect native multiple import map support.
 *
 * @param specifier Module specifier to load.
 * @param parentUrl URL to resolve the specifier from. (default: `document.baseURI`)
 * @returns The loaded module namespace.
 */
export async function importShim(specifier, parentUrl = document.baseURI) {
    let runtime = await getRuntime();
    return runtime.importShim(specifier, parentUrl);
}
/**
 * Fetches one or more JavaScript modules through the polyfill for a later polyfilled import. This
 * function does not use native module preloads.
 *
 * Preload failures are ignored. A later import reports the failure if the module is required.
 *
 * @param specifiers Module specifier or specifiers to preload.
 * @param parentUrl URL to resolve the specifiers from. (default: `document.baseURI`)
 * @returns A promise that settles after all module fetches have completed.
 */
export async function preloadShim(specifiers, parentUrl = document.baseURI) {
    try {
        let runtime = await getRuntime();
        await runtime.preloadShim(specifiers, parentUrl);
    }
    catch { }
}
async function getRuntime() {
    runtimePromise ??= import('./core.js');
    let runtime = await runtimePromise;
    runtime.registerNativeModule(import.meta.url);
    return runtime;
}
