import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from '@remix-run/ui/accordion';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Accordion Overview
 * @description A single-open disclosure list that keeps settings, billing, or notification rules in one calm section.
 * @layout center
 * @order 1
 */
export default function Example() {
    return () => (_jsxs(Accordion, { defaultValue: "account", children: [_jsxs(AccordionItem, { value: "account", children: [_jsx(AccordionTrigger, { children: "Account defaults" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Keep billing contacts, email summaries, and workspace naming rules in one calm disclosure list without adding another card layer." }) })] }), _jsxs(AccordionItem, { value: "billing", children: [_jsx(AccordionTrigger, { children: "Billing schedule" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Review invoice timing, payment methods, and renewal reminders with the same spacing and typography used elsewhere in the system." }) })] }), _jsxs(AccordionItem, { value: "notifications", children: [_jsx(AccordionTrigger, { children: "Notification rules" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Use single mode when only one details panel should stay open at a time in a compact settings or details view." }) })] })] }));
}
const bodyTextCss = css({
    margin: 0,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.relaxed,
    color: theme.colors.text.secondary,
});
//# sourceMappingURL=overview.demo.js.map