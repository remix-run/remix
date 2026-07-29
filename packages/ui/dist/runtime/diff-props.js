import { invariant } from "./invariant.js";
import { createStyleManager } from "../style/index.js";
let globalStyleManager = typeof window !== 'undefined' ? createStyleManager() : null;
export {};
export { patchHostProps as diffHostProps } from "./core/props.js";
export let defaultStyleManager = globalStyleManager;
/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export function resetStyleState() {
    invariant(typeof window !== 'undefined', 'resetStyleState() is only available in a browser environment');
    globalStyleManager.dispose();
    globalStyleManager = createStyleManager();
    defaultStyleManager = globalStyleManager;
}
//# sourceMappingURL=diff-props.js.map