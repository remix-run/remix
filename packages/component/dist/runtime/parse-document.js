import { invariant } from './invariant.js';
export function parseDocument(doc, content) {
    let parsed = doc.implementation.createHTMLDocument();
    parsed.open();
    // Let the native parser find the opening html element and its attributes. The
    // delimiters only split input chunks; the parser handles comments and quoted >.
    let offset = 0;
    while (!parsed.documentElement && offset < content.length) {
        let end = content.indexOf('>', offset);
        let next = end === -1 ? content.length : end + 1;
        parsed.write(content.slice(offset, next));
        offset = next;
    }
    let root = parsed.documentElement;
    root?.remove();
    parsed.close();
    root ??= parsed.documentElement;
    invariant(root, 'Missing document element');
    root.remove();
    // Fragment parsing keeps scripts inert. Keep the root disconnected so styles
    // cannot enforce CSP before their response nonces have been rewritten.
    root.innerHTML = content;
    removeNoscriptContents(root);
    return root;
}
export function removeNoscriptContents(source) {
    // Frame navigation requires scripting; fallback markup must stay inactive.
    for (let noscript of source.querySelectorAll('noscript'))
        noscript.textContent = '';
    for (let template of source.querySelectorAll('template')) {
        removeNoscriptContents(template.content);
    }
}
//# sourceMappingURL=parse-document.js.map