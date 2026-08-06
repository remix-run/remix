import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, createElement, } from '@remix-run/ui';
import { spring } from '@remix-run/ui/animation';
import * as accordion from '@remix-run/ui/accordion/primitives';
import { ChevronRightIcon } from "../shared/icons.js";
import { componentStyleValues as styles } from "../shared/style-values.js";
const accordionPanelClipCss = css({
    minHeight: 0,
    overflow: 'hidden',
});
const accordionTransition = spring();
const accordionRootCss = css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
});
const accordionItemCss = css({
    minWidth: 0,
});
const accordionHeadingCss = css({
    margin: 0,
    minWidth: 0,
});
const accordionTriggerCss = css({
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: styles.space.md,
    width: '100%',
    minHeight: '28px',
    padding: `${styles.space.xs} 0`,
    color: styles.colors.text.primary,
    fontFamily: styles.fontFamily.sans,
    fontSize: styles.fontSize.sm,
    lineHeight: styles.lineHeight.normal,
    fontWeight: styles.fontWeight.medium,
    textAlign: 'left',
    '&:hover:not(:disabled)': {
        backgroundColor: styles.surface.lvl1,
    },
    '&:hover:not(:disabled) > span:first-child': {
        textDecorationLine: 'underline',
    },
    '&:focus-visible': {
        outline: `2px solid ${styles.colors.focus.ring}`,
        outlineOffset: '2px',
    },
    '&:disabled': {
        cursor: 'default',
        opacity: 0.55,
    },
    '& > span:first-child': {
        minWidth: 0,
    },
});
const accordionIndicatorCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: styles.fontSize.sm,
    height: styles.fontSize.sm,
    color: styles.colors.text.muted,
    transition: `transform ${accordionTransition}`,
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
    '&[data-state="open"]': {
        transform: 'rotate(90deg)',
    },
});
const accordionPanelCss = css({
    display: 'grid',
    gridTemplateRows: '0fr',
    transition: `grid-template-rows ${accordionTransition}`,
    '&[data-state="open"]': {
        gridTemplateRows: '1fr',
    },
    '&[data-state="closed"]': {
        pointerEvents: 'none',
    },
    '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
    },
});
const accordionBodyCss = css({
    display: 'flow-root',
    minHeight: 0,
    paddingBottom: styles.space.md,
    color: styles.colors.text.secondary,
    fontSize: styles.fontSize.sm,
    lineHeight: styles.lineHeight.relaxed,
    '& > :first-child': {
        marginTop: 0,
    },
    '& > :last-child': {
        marginBottom: 0,
    },
});
export const rootStyle = accordionRootCss;
export const itemStyle = accordionItemCss;
export const headingStyle = accordionHeadingCss;
export const triggerStyle = accordionTriggerCss;
export const indicatorStyle = accordionIndicatorCss;
export const panelStyle = accordionPanelCss;
export const bodyStyle = accordionBodyCss;
export function Accordion(handle) {
    return () => {
        if (handle.props.type === 'multiple') {
            let { children, defaultValue, disabled, headingLevel, mix, onValueChange, type, value, ...divProps } = handle.props;
            return (_jsx(accordion.Context, { defaultValue: defaultValue, disabled: disabled, headingLevel: headingLevel, onValueChange: onValueChange, type: type, value: value, children: _jsx("div", { ...divProps, mix: [rootStyle, accordion.root(), mix], children: children }) }));
        }
        let { children, collapsible, defaultValue, disabled, headingLevel, mix, onValueChange, type, value, ...divProps } = handle.props;
        return (_jsx(accordion.Context, { collapsible: collapsible, defaultValue: defaultValue, disabled: disabled, headingLevel: headingLevel, onValueChange: onValueChange, type: type, value: value, children: _jsx("div", { ...divProps, mix: [rootStyle, accordion.root(), mix], children: children }) }));
    };
}
export function AccordionItem(handle) {
    return () => {
        let { children, disabled, mix, value, ...divProps } = handle.props;
        return (_jsx(accordion.ItemContext, { disabled: disabled, value: value, children: _jsx("div", { ...divProps, mix: [itemStyle, accordion.item(), mix], children: children }) }));
    };
}
export function AccordionTrigger(handle) {
    return () => {
        let item = handle.context.get(accordion.ItemContext);
        let headingTag = `h${item.headingLevel}`;
        let { children, disabled, indicator, mix, type, ...buttonProps } = handle.props;
        let button = (_jsxs("button", { ...buttonProps, mix: [triggerStyle, accordion.trigger({ disabled }), mix], type: type ?? 'button', children: [_jsx("span", { children: children }), indicator === null ? null : (_jsx("span", { "data-rmx-accordion-indicator": "", "data-state": item.open ? 'open' : 'closed', mix: indicatorStyle, children: indicator ?? _jsx(ChevronRightIcon, {}) }))] }));
        return createElement(headingTag, { mix: headingStyle }, button);
    };
}
export function AccordionContent(handle) {
    return () => {
        let { children, mix, ...panelProps } = handle.props;
        return (_jsx("div", { ...panelProps, mix: [panelStyle, accordion.content(), mix], children: _jsx("div", { mix: accordionPanelClipCss, children: _jsx("div", { mix: bodyStyle, children: children }) }) }));
    };
}
//# sourceMappingURL=index.js.map