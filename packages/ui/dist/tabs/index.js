import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { css, } from '@remix-run/ui';
import * as tabs from '@remix-run/ui/tabs/primitives';
export { TabsChangeEvent, onTabsChange } from '@remix-run/ui/tabs/primitives';
const tabSliderBackground = 'linear-gradient(180deg, rgba(0, 0, 0, 0) 33%, light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.08)) 100%), light-dark(#FFFFFF, #1a1a1a)';
const tabSliderShadow = '0 0 0 0.5px light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.12)), 0 1px 1px -0.5px rgba(0, 0, 0, 0.12), 0 2px 2px -1px rgba(0, 0, 0, 0.12), 0 4px 4px -2px rgba(0, 0, 0, 0.12), inset 0 0 2px 1px light-dark(#FFFFFF, rgba(255, 255, 255, 0.08))';
const tabsRootCss = css({
    '--rmx-tabs-height': '32px',
    '--rmx-tabs-track-padding': '2px',
    '--rmx-tabs-tab-padding-inline': '12px',
    '--rmx-tabs-tab-shadow': '0 0 0 0 rgba(0, 0, 0, 0)',
    '--rmx-tabs-tab-font-size': '12px',
    '--rmx-tabs-tab-line-height': '17px',
    '--rmx-tabs-gap': '12px',
    boxSizing: 'border-box',
    display: 'grid',
    gap: 'var(--rmx-tabs-gap)',
    minWidth: 0,
});
const tabsListCss = css({
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    width: 'max-content',
    maxWidth: '100%',
    minHeight: 'var(--rmx-tabs-height)',
    padding: 'var(--rmx-tabs-track-padding)',
    border: 0,
    borderRadius: '9999px',
    background: 'linear-gradient(180deg, light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08)) 0%, rgba(0, 0, 0, 0) 100%), light-dark(#EBEBEB, #2c2c2c)',
    boxShadow: 'inset 0 0 4px 1px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(0, 0, 0, 0.02), inset 0 2px 2px rgba(0, 0, 0, 0.02)',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
        display: 'none',
    },
    '&[aria-disabled="true"]': {
        opacity: 0.55,
    },
});
const tabsTabCss = css({
    '--rmx-tabs-tab-focus-shadow': '0 0 0 1px light-dark(#3573F6, #6eaaff), var(--rmx-tabs-tab-shadow), 0 0 0 4px light-dark(rgba(53, 115, 246, 0.1), rgba(110, 170, 255, 0.18)), 0 6px 32px 4px light-dark(rgba(53, 115, 246, 0.08), rgba(110, 170, 255, 0.14)), inset 0 0 8px 1px light-dark(rgba(53, 115, 246, 0.05), rgba(110, 170, 255, 0.1))',
    appearance: 'none',
    margin: 0,
    boxSizing: 'border-box',
    position: 'relative',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: '4px',
    width: 'max-content',
    maxWidth: '100%',
    minWidth: 0,
    height: 'calc(var(--rmx-tabs-height) - (var(--rmx-tabs-track-padding) * 2))',
    minHeight: 'calc(var(--rmx-tabs-height) - (var(--rmx-tabs-track-padding) * 2))',
    paddingBlock: 0,
    paddingInline: 'var(--rmx-tabs-tab-padding-inline)',
    border: 0,
    borderRadius: '999px',
    background: 'transparent',
    boxShadow: 'var(--rmx-tabs-tab-shadow)',
    color: 'light-dark(#707070, #b3b3b3)',
    fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    fontStyle: 'normal',
    fontWeight: 500,
    fontSize: 'var(--rmx-tabs-tab-font-size)',
    lineHeight: 'var(--rmx-tabs-tab-line-height)',
    fontFeatureSettings: '"ss01" on, "cv01" on',
    letterSpacing: 0,
    textAlign: 'center',
    textDecoration: 'none',
    textShadow: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
    '&[data-state="inactive"]:hover:not(:disabled):not([aria-disabled="true"])': {
        background: 'light-dark(rgba(16, 16, 16, 0.05), rgba(236, 236, 236, 0.1))',
        color: 'light-dark(#101010, #ececec)',
    },
    '&[data-state="inactive"]:active:not(:disabled):not([aria-disabled="true"])': {
        background: 'light-dark(rgba(16, 16, 16, 0.08), rgba(236, 236, 236, 0.14))',
    },
    '&[data-state="active"]': {
        background: tabSliderBackground,
        '--rmx-tabs-tab-shadow': tabSliderShadow,
        color: 'light-dark(#101010, #ececec)',
        textShadow: '0 1px 0 light-dark(#FFFFFF, rgb(0 0 0 / 0.35))',
    },
    '&[data-state="active"]:hover:not(:disabled):not([aria-disabled="true"])': {
        background: tabSliderBackground,
    },
    '&[data-state="active"]:active:not(:disabled):not([aria-disabled="true"])': {
        background: tabSliderBackground,
    },
    '&:disabled, &[aria-disabled="true"]': {
        cursor: 'not-allowed',
        opacity: 0.55,
    },
    '&:focus-visible': {
        outline: 0,
        boxShadow: 'var(--rmx-tabs-tab-focus-shadow)',
    },
});
const tabsPanelCss = css({
    minWidth: 0,
    color: 'light-dark(#101010, #ececec)',
    fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: '13px',
    lineHeight: '20px',
    letterSpacing: 0,
    '&[hidden]': {
        display: 'none',
    },
});
const sizeStyles = {
    md: css({}),
    lg: css({
        '--rmx-tabs-height': '36px',
        '--rmx-tabs-tab-padding-inline': '14px',
        '--rmx-tabs-tab-font-size': '13px',
        '--rmx-tabs-tab-line-height': '20px',
        '--rmx-tabs-gap': '14px',
    }),
};
export const rootStyle = tabsRootCss;
export const listStyle = tabsListCss;
export const tabStyle = tabsTabCss;
export const panelStyle = tabsPanelCss;
export function Tabs(handle) {
    return () => {
        let { activeTab, children, defaultActiveTab, disabled, mix, onActiveTabChange, size = 'md', ...divProps } = handle.props;
        return (_jsx(tabs.Context, { activeTab: activeTab, defaultActiveTab: defaultActiveTab, disabled: disabled, onActiveTabChange: onActiveTabChange, children: _jsx("div", { ...divProps, mix: [rootStyle, sizeStyles[size], tabs.root(), mix], children: children }) }));
    };
}
export function TabList(handle) {
    return () => {
        let { children, mix, ...divProps } = handle.props;
        return (_jsx("div", { ...divProps, mix: [listStyle, tabs.list(), mix], children: children }));
    };
}
export function Tab(handle) {
    return () => {
        let { children, disabled, mix, name, type, ...buttonProps } = handle.props;
        return (_jsx("button", { ...buttonProps, mix: [tabStyle, tabs.tab({ disabled, name }), mix], type: type ?? 'button', children: children }));
    };
}
export function TabPanel(handle) {
    return () => {
        let { children, mix, name, ...divProps } = handle.props;
        return (_jsx("div", { ...divProps, mix: [panelStyle, tabs.panel({ name }), mix], children: children }));
    };
}
//# sourceMappingURL=index.js.map