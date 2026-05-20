import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from '@remix-run/ui/accordion';
import { theme } from '@remix-run/ui/theme';
/**
 * @order 2
 * @name Accordion Multiple Open
 * @description Multiple mode allows several sections to stay open simultaneously, useful for operational checklists and dashboards.
 */
export default function Example() {
    return () => (_jsxs(Accordion, { defaultValue: ['api', 'alerts'], type: "multiple", children: [_jsxs(AccordionItem, { value: "api", children: [_jsx(AccordionTrigger, { children: "API status checks" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Multiple mode works well for operational checklists and dashboards where several sections often need to stay open together." }) })] }), _jsxs(AccordionItem, { disabled: true, value: "access", children: [_jsx(AccordionTrigger, { children: "Access control sync" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "This section is intentionally disabled to show how one unavailable item should read inside an otherwise active list." }) })] }), _jsxs(AccordionItem, { value: "alerts", children: [_jsx(AccordionTrigger, { children: "Alert routing" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Disabled items should feel clearly unavailable without changing the overall visual model of the disclosure list." }) })] })] }));
}
const bodyTextCss = css({
    margin: 0,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.relaxed,
    color: theme.colors.text.secondary,
});
//# sourceMappingURL=multiple.demo.js.map