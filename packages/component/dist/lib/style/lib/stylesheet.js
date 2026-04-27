const SERVER_STYLE_SELECTOR = 'style[data-rmx]';
const DEFAULT_STYLE_LAYER = 'rmx';
function getStyleLayerName(className, layer = DEFAULT_STYLE_LAYER) {
    return `${layer}.${className}`;
}
function compareNodesInDocumentOrder(a, b) {
    if (a === b)
        return 0;
    let position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING)
        return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING)
        return 1;
    return 0;
}
function isParentNode(value) {
    return 'querySelectorAll' in value;
}
function collectServerStyleTagsFromNode(node, into) {
    if (isHtmlStyleElement(node) && node.matches(SERVER_STYLE_SELECTOR)) {
        into.add(node);
        return;
    }
    if (!(node instanceof Element) &&
        !(node instanceof Document) &&
        !(node instanceof DocumentFragment)) {
        return;
    }
    let nested = node.querySelectorAll?.(SERVER_STYLE_SELECTOR) ?? [];
    for (let i = 0; i < nested.length; i++) {
        let el = nested[i];
        if (isHtmlStyleElement(el)) {
            into.add(el);
        }
    }
}
function collectServerStyleTags(source) {
    let styles = new Set();
    if (isParentNode(source)) {
        collectServerStyleTagsFromNode(source, styles);
    }
    else {
        for (let node of source) {
            collectServerStyleTagsFromNode(node, styles);
        }
    }
    return Array.from(styles).sort(compareNodesInDocumentOrder);
}
function isHtmlStyleElement(node) {
    return typeof node === 'object' && node !== null && node instanceof HTMLStyleElement;
}
function getStyleSelector(styleEl) {
    let selector = styleEl.getAttribute('data-rmx')?.trim();
    return selector ? selector : null;
}
export function createStyleManager(layer = 'rmx') {
    let stylesheet = null;
    // Track usage count and rule index per className
    // Using an object to track both count and index together
    let ruleMap = new Map();
    function getStylesheet() {
        if (!stylesheet) {
            stylesheet = new CSSStyleSheet();
            document.adoptedStyleSheets.push(stylesheet);
        }
        return stylesheet;
    }
    function removeStylesheet() {
        if (!stylesheet)
            return;
        document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== stylesheet);
        stylesheet = null;
    }
    function clearStylesheet() {
        if (!stylesheet)
            return;
        for (let i = stylesheet.cssRules.length - 1; i >= 0; i--) {
            stylesheet.deleteRule(i);
        }
    }
    function adoptServerStyleTag(styleEl) {
        let selector = getStyleSelector(styleEl);
        if (!selector)
            return;
        if (ruleMap.has(selector)) {
            styleEl.remove();
            return;
        }
        let cssText = styleEl.textContent?.trim() ?? '';
        if (cssText.length === 0) {
            styleEl.remove();
            return;
        }
        try {
            let sheet = getStylesheet();
            let index = sheet.cssRules.length;
            sheet.insertRule(cssText, index);
            ruleMap.set(selector, { count: 1, index });
            styleEl.remove();
        }
        catch {
            // If adoption fails, keep the <style> tag in the DOM so styles still apply.
        }
    }
    function has(className) {
        let entry = ruleMap.get(className);
        return entry !== undefined && entry.count > 0;
    }
    function insert(className, rule) {
        let entry = ruleMap.get(className);
        if (entry) {
            // Already exists, just increment count
            entry.count++;
            return;
        }
        // New rule - insert and track
        let sheet = getStylesheet();
        let index = sheet.cssRules.length;
        // This may throw for invalid CSS. If it does, we intentionally let it
        // bubble so the rule is not tracked unless insertion actually succeeds.
        sheet.insertRule(`@layer ${getStyleLayerName(className, layer)} { ${rule} }`, index);
        ruleMap.set(className, { count: 1, index });
    }
    function remove(className) {
        let entry = ruleMap.get(className);
        if (!entry)
            return;
        // Decrement count
        entry.count--;
        if (entry.count > 0) {
            // Still in use, keep the rule
            return;
        }
        // Count reached zero, remove the rule
        let indexToDelete = entry.index;
        // Remove from tracking
        ruleMap.delete(className);
        // TODO: just search and remove, stop re-indexing
        if (!stylesheet)
            return;
        stylesheet.deleteRule(indexToDelete);
        // Update indices for all rules that came after the deleted one
        // They all shift down by 1
        for (let [, data] of ruleMap.entries()) {
            if (data.index > indexToDelete) {
                data.index--;
            }
        }
    }
    function reset() {
        clearStylesheet();
        ruleMap.clear();
        removeStylesheet();
    }
    function adoptServerStyles(source) {
        let styles = collectServerStyleTags(source);
        for (let styleEl of styles) {
            adoptServerStyleTag(styleEl);
        }
    }
    function dispose() {
        removeStylesheet();
        // Clear internal state
        ruleMap.clear();
    }
    return { insert, remove, has, reset, adoptServerStyles, dispose };
}
//# sourceMappingURL=stylesheet.js.map