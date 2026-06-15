import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { on } from '@remix-run/ui';
/**
 * @name Controlled and Uncontrolled Values
 * @description Compares controlled props with uncontrolled DOM values across rerenders and remounts.
 */
export default function App(handle) {
    let controlledText = 'hello';
    let controlledChecked = true;
    let controlledChoice = 'alpha';
    let uncontrolledTextSnapshot = 'type to update this';
    let uncontrolledCheckedSnapshot = true;
    let renderCount = 0;
    let uncontrolledVersion = 0;
    let rerender = () => {
        renderCount++;
        handle.update();
    };
    let resetControlled = () => {
        controlledText = 'hello';
        controlledChecked = true;
        controlledChoice = 'alpha';
        rerender();
    };
    let remountUncontrolled = () => {
        uncontrolledVersion++;
        uncontrolledTextSnapshot = 'type to update this';
        uncontrolledCheckedSnapshot = true;
        rerender();
    };
    return () => (_jsxs("main", { style: {
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '860px',
            margin: '24px auto',
            padding: '0 16px',
            lineHeight: 1.45,
        }, children: [_jsx("h1", { children: "Controlled vs Uncontrolled Values" }), _jsxs("p", { children: ["Render count: ", _jsx("strong", { children: renderCount })] }), _jsxs("div", { style: { display: 'flex', gap: '10px', marginBottom: '18px' }, children: [_jsx("button", { mix: [on('click', rerender)], children: "Force Re-render" }), _jsx("button", { mix: [on('click', resetControlled)], children: "Reset Controlled" }), _jsx("button", { mix: [on('click', remountUncontrolled)], children: "Remount Uncontrolled" })] }), _jsxs("section", { style: {
                    border: '1px solid #d0d7de',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                }, children: [_jsx("h2", { children: "Controlled" }), _jsx("p", { children: "These values come from component state. The text input allows everything except digits, and invalid input does not call update." }), _jsxs("label", { style: { display: 'block', marginBottom: '8px' }, children: ["Text:", _jsx("input", { style: { marginLeft: '8px' }, value: controlledText, mix: [
                                    on('input', (event) => {
                                        let nextValue = event.currentTarget.value;
                                        if (/\d/.test(nextValue)) {
                                            return;
                                        }
                                        controlledText = nextValue;
                                        rerender();
                                    }),
                                ] })] }), _jsxs("label", { style: { display: 'block', marginBottom: '8px' }, children: [_jsx("input", { type: "checkbox", checked: controlledChecked, mix: [
                                    on('change', (event) => {
                                        controlledChecked = event.currentTarget.checked;
                                        rerender();
                                    }),
                                ] }), ' ', "Checked"] }), _jsxs("label", { style: { display: 'block', marginBottom: '8px' }, children: ["Choice:", _jsxs("select", { style: { marginLeft: '8px' }, value: controlledChoice, mix: [
                                    on('change', (event) => {
                                        controlledChoice = event.currentTarget.value;
                                        rerender();
                                    }),
                                ], children: [_jsx("option", { value: "alpha", children: "Alpha" }), _jsx("option", { value: "beta", children: "Beta" }), _jsx("option", { value: "gamma", children: "Gamma" })] })] }), _jsxs("div", { children: ["State snapshot: text=", _jsx("code", { children: JSON.stringify(controlledText) }), ", checked=", _jsx("code", { children: String(controlledChecked) }), ", choice=", _jsx("code", { children: JSON.stringify(controlledChoice) })] })] }), _jsxs("section", { style: {
                    border: '1px solid #d0d7de',
                    borderRadius: '8px',
                    padding: '12px',
                }, children: [_jsx("h2", { children: "Uncontrolled" }), _jsxs("p", { children: ["These initialize from ", _jsx("code", { children: "defaultValue/defaultChecked" }), " once and then keep their own DOM state."] }), _jsxs("label", { style: { display: 'block', marginBottom: '8px' }, children: ["Text:", _jsx("input", { style: { marginLeft: '8px' }, defaultValue: "type to update this", mix: [
                                    on('input', (event) => {
                                        uncontrolledTextSnapshot = event.currentTarget.value;
                                        rerender();
                                    }),
                                ] })] }), _jsxs("label", { style: { display: 'block', marginBottom: '8px' }, children: [_jsx("input", { type: "checkbox", defaultChecked: true, mix: [
                                    on('change', (event) => {
                                        uncontrolledCheckedSnapshot = event.currentTarget.checked;
                                        rerender();
                                    }),
                                ] }), ' ', "Checked"] }), _jsxs("div", { children: ["Last DOM snapshot: text=", _jsx("code", { children: JSON.stringify(uncontrolledTextSnapshot) }), ", checked=", _jsx("code", { children: String(uncontrolledCheckedSnapshot) })] })] }, `uncontrolled-${uncontrolledVersion}`)] }));
}
//# sourceMappingURL=controlled-uncontrolled-values.demo.js.map