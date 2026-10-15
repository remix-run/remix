var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { self } from './self.js';
export const hasDocument = typeof document !== 'undefined';
export const dynamicImport = (u) => import(__rewriteRelativeImportExtension(u));
export const defaultFetchOpts = { credentials: 'same-origin' };
export const version = `remix/multiple-import-maps-polyfill:${Date.now()}:${Math.random()}`;
export let nonce = '';
if (hasDocument) {
    let nonceElement = document.querySelector('script[nonce]');
    if (nonceElement)
        nonce = nonceElement.nonce || nonceElement.getAttribute('nonce') || '';
}
export const baseUrl = hasDocument
    ? document.baseURI
    : typeof location !== 'undefined'
        ? `${location.protocol}//${location.host}${location.pathname.includes('/')
            ? location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1)
            : location.pathname}`
        : 'about:blank';
export const createBlob = (source) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
const dispatchError = (error) => self.dispatchEvent(Object.assign(new Event('error'), { error }));
export const throwError = (err) => {
    ;
    (self.reportError || dispatchError)(err);
};
export const fromParent = (parent) => (parent ? ` imported from ${parent}` : '');
