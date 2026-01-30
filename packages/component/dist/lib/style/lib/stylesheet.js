// .rmx-23ace { color: red; }
// <ul>{item.map(() => <li css={{ color: 'red' }}>)}
export function createStyleManager(layer = 'rmx') {
    let stylesheet = new CSSStyleSheet();
    document.adoptedStyleSheets.push(stylesheet);
    // Track usage count and rule index per className
    // Using an object to track both count and index together
    let ruleMap = new Map();
    // Adopt server-rendered styles from <style data-rmx-styles>
    let serverStyle = document.querySelector('style[data-rmx-styles]');
    if (serverStyle && serverStyle.sheet) {
        let rules = serverStyle.sheet.cssRules;
        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i];
            // Server renders @layer rmx { [data-css="rmx-xxx"] { ... } }
            if (rule instanceof CSSLayerBlockRule) {
                for (let j = 0; j < rule.cssRules.length; j++) {
                    let innerRule = rule.cssRules[j];
                    if (innerRule instanceof CSSStyleRule) {
                        // Extract selector like [data-css="rmx-abc123"]
                        let match = innerRule.selectorText.match(/\[data-css="([^"]+)"\]/);
                        if (match) {
                            let className = match[1];
                            // Track as existing (count: 1, index: -1 since it's in server style tag)
                            ruleMap.set(className, { count: 1, index: -1 });
                        }
                    }
                }
            }
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
        let index = stylesheet.cssRules.length;
        try {
            stylesheet.insertRule(`@layer ${layer} { ${rule} }`, index);
            ruleMap.set(className, { count: 1, index });
        }
        catch (error) {
            // If insertion fails (e.g., invalid CSS), don't track it
            // The browser will have thrown, so we can't proceed
            throw error;
        }
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
        // Server-rendered rules (index: -1) stay in the <style> tag, nothing to delete
        if (indexToDelete < 0)
            return;
        // TODO: just search and remove, stop re-indexing
        stylesheet.deleteRule(indexToDelete);
        // Update indices for all rules that came after the deleted one
        // They all shift down by 1
        for (let [name, data] of ruleMap.entries()) {
            if (data.index > indexToDelete) {
                data.index--;
            }
        }
    }
    function dispose() {
        // Remove stylesheet from document
        document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== stylesheet);
        // Clear internal state
        ruleMap.clear();
    }
    return { insert, remove, has, dispose };
}
//# sourceMappingURL=stylesheet.js.map