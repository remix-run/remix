import { self } from './self.js';
const trustedTypesGlobal = self;
export let policy;
if (typeof trustedTypesGlobal !== 'undefined' &&
    (typeof trustedTypesGlobal.trustedTypes !== 'undefined' ||
        typeof trustedTypesGlobal.TrustedTypes !== 'undefined')) {
    try {
        let trustedTypes = (trustedTypesGlobal.trustedTypes || trustedTypesGlobal.TrustedTypes);
        policy = trustedTypes.createPolicy('remix/multiple-import-maps-polyfill', {
            createHTML: (html) => html,
            createScript: (script) => script,
        });
    }
    catch { }
}
export function maybeTrustedInnerHTML(html) {
    return policy ? policy.createHTML(html) : html;
}
export function maybeTrustedScript(script) {
    return policy ? policy.createScript(script) : script;
}
