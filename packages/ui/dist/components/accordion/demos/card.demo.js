import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from '@remix-run/ui/accordion';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Accordion in a Card
 * @description The Accordion can sit inside a card when the surrounding surface needs stronger grouping.
 * @layout center
 * @order 3
 */
export default function Example() {
    return () => (_jsxs("article", { mix: cardCss, children: [_jsxs("div", { mix: cardHeaderCss, children: [_jsx("p", { mix: eyebrowCss, children: "Project settings" }), _jsx("h3", { mix: titleCss, children: "Deployment policies" }), _jsx("p", { mix: descriptionCss, children: "The Accordion can sit inside a card when the surrounding surface needs stronger grouping." })] }), _jsx("div", { mix: accordionInsetCss, children: _jsxs(Accordion, { defaultValue: "reviews", children: [_jsxs(AccordionItem, { value: "reviews", children: [_jsx(AccordionTrigger, { children: "Required approvals" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Require one reviewer for routine changes and two reviewers for dependency, auth, or billing-related changes." }) })] }), _jsxs(AccordionItem, { value: "windows", children: [_jsx(AccordionTrigger, { children: "Release windows" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Schedule production deploys on weekdays before 3 PM so incidents and rollback work stay inside staffed hours." }) })] }), _jsxs(AccordionItem, { value: "rollback", children: [_jsx(AccordionTrigger, { children: "Rollback policy" }), _jsx(AccordionContent, { children: _jsx("p", { mix: bodyTextCss, children: "Keep a rollback target ready for every release and treat rollback preparation as part of the normal change checklist." }) })] })] }) })] }));
}
const cardCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.md,
    padding: theme.space.lg,
    border: `1px solid ${theme.colors.border.subtle}`,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface.lvl0,
    boxShadow: theme.shadow.xs,
});
const cardHeaderCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.sm,
});
const accordionInsetCss = css({
    paddingInline: theme.space.lg,
});
const eyebrowCss = css({
    margin: 0,
    fontSize: theme.fontSize.xxxs,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: theme.letterSpacing.meta,
    textTransform: 'uppercase',
    color: theme.colors.text.muted,
});
const titleCss = css({
    margin: 0,
    fontSize: theme.fontSize.lg,
    lineHeight: theme.lineHeight.tight,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
});
const descriptionCss = css({
    margin: 0,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.relaxed,
    color: theme.colors.text.secondary,
});
const bodyTextCss = css({
    margin: 0,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.relaxed,
    color: theme.colors.text.secondary,
});
//# sourceMappingURL=card.demo.js.map