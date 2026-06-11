import { jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { on } from '@remix-run/ui';
/**
 * @name Basic Counter
 * @description The smallest interactive Remix UI counter from the standalone demos.
 */
export default function App(handle) {
    let count = 0;
    return () => (_jsxs("button", { mix: [
            on('click', () => {
                count++;
                handle.update();
            }),
        ], children: ["Ye ol' counter: ", count] }));
}
//# sourceMappingURL=basic.demo.js.map