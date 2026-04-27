import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx createElement
import { attrs, css, createElement, createMixin, on, pressEvents, } from '@remix-run/component';
import * as button from "../button/button.js";
import { theme } from "../theme/theme.js";
const TABS_CHANGE_EVENT = 'rmx:tabs-change';
const tabsListCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space.xs,
    minWidth: 0,
    padding: theme.space.xs,
    border: `1px solid ${theme.colors.border.subtle}`,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.surface.lvl2,
});
const tabsTriggerCss = css({
    justifyContent: 'flex-start',
    minHeight: theme.control.height.md,
    paddingInline: theme.space.md,
    border: '1px solid transparent',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.md,
    '&:hover:not(:disabled):not([aria-disabled="true"])': {
        color: theme.colors.text.primary,
    },
    '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
        color: theme.colors.text.primary,
    },
    '&[aria-selected="true"], &[aria-selected="true"]:hover, &[aria-selected="true"]:focus-visible': {
        backgroundColor: theme.surface.lvl0,
        borderColor: theme.colors.border.subtle,
        boxShadow: theme.shadow.xs,
        color: theme.colors.text.primary,
    },
    '&:disabled, &[aria-disabled="true"]': {
        opacity: 0.55,
    },
});
export const listStyle = tabsListCss;
export const triggerStyle = tabsTriggerCss;
const panelVisibilityUtility = css({
    '&[hidden]': {
        display: 'none',
    },
});
export class TabsChangeEvent extends Event {
    previousValue;
    value;
    constructor(value, previousValue) {
        super(TABS_CHANGE_EVENT, { bubbles: true });
        this.value = value;
        this.previousValue = previousValue;
    }
}
function getTabsContext(handle) {
    return handle.context.get(TabsProvider);
}
function toIdFragment(value) {
    let fragment = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return fragment || 'tab';
}
function TabsProvider(handle) {
    let props = {};
    let registeredTabs = [];
    let hasInitialized = false;
    let uncontrolledValue = null;
    function getValue() {
        return props.value !== undefined ? props.value : uncontrolledValue;
    }
    function getOrientation() {
        return props.orientation ?? 'horizontal';
    }
    function isActiveTab(tab) {
        return !!tab && !tab.disabled && !!tab.getNode()?.isConnected;
    }
    function getTab(value) {
        if (value == null) {
            return undefined;
        }
        return registeredTabs.find((tab) => tab.value === value);
    }
    function getEnabledTabs() {
        return registeredTabs.filter(isActiveTab);
    }
    function getFocusableValue() {
        let currentValue = getValue();
        let currentTab = getTab(currentValue);
        if (isActiveTab(currentTab)) {
            return currentValue;
        }
        return getEnabledTabs()[0]?.value ?? null;
    }
    function getTargetTab(fromValue, direction) {
        let enabledTabs = getEnabledTabs();
        if (enabledTabs.length === 0) {
            return undefined;
        }
        let currentIndex = enabledTabs.findIndex((tab) => tab.value === fromValue);
        let targetIndex = 0;
        switch (direction) {
            case 'first':
                targetIndex = 0;
                break;
            case 'last':
                targetIndex = enabledTabs.length - 1;
                break;
            case 'next':
                targetIndex =
                    currentIndex === -1 || currentIndex === enabledTabs.length - 1 ? 0 : currentIndex + 1;
                break;
            case 'previous':
                targetIndex = currentIndex <= 0 ? enabledTabs.length - 1 : currentIndex - 1;
                break;
        }
        return enabledTabs[targetIndex];
    }
    function dispatchChange(value, previousValue) {
        getTab(value)?.getNode()?.dispatchEvent(new TabsChangeEvent(value, previousValue));
    }
    function select(value) {
        let nextTab = getTab(value);
        if (!isActiveTab(nextTab)) {
            return;
        }
        let previousValue = getValue();
        if (previousValue === value) {
            return;
        }
        if (props.value === undefined) {
            uncontrolledValue = value;
            void handle.update();
        }
        props.onValueChange?.(value);
        dispatchChange(value, previousValue ?? null);
    }
    let tabsRef = {
        get selectedValue() {
            return getValue();
        },
        focus(value = getFocusableValue() ?? undefined) {
            getTab(value)?.getNode()?.focus();
        },
        focusFirst() {
            getTargetTab(getFocusableValue() ?? '', 'first')
                ?.getNode()
                ?.focus();
        },
        focusLast() {
            getTargetTab(getFocusableValue() ?? '', 'last')
                ?.getNode()
                ?.focus();
        },
        select,
    };
    handle.context.set({
        get focusableValue() {
            return getFocusableValue();
        },
        get orientation() {
            return getOrientation();
        },
        get value() {
            return getValue();
        },
        getPanelId(value) {
            return `${handle.id}-panel-${toIdFragment(value)}`;
        },
        getTriggerId(value) {
            return `${handle.id}-trigger-${toIdFragment(value)}`;
        },
        move(fromValue, direction) {
            let target = getTargetTab(fromValue, direction);
            if (!target) {
                return;
            }
            target.getNode()?.focus();
            select(target.value);
        },
        registerTab(tab) {
            registeredTabs.push(tab);
        },
        select,
    });
    return (nextProps) => {
        registeredTabs = [];
        props = nextProps;
        if (!hasInitialized) {
            uncontrolledValue = props.defaultValue ?? null;
            hasInitialized = true;
        }
        handle.queueTask(() => {
            props.ref?.(tabsRef);
            if (props.value !== undefined) {
                return;
            }
            let nextValue = getFocusableValue();
            if (nextValue === uncontrolledValue) {
                return;
            }
            uncontrolledValue = nextValue;
            void handle.update();
        });
        return props.children;
    };
}
const listMixin = createMixin((handle) => {
    let context = getTabsContext(handle);
    return () => attrs({
        role: 'tablist',
        'aria-orientation': context.orientation === 'vertical' ? 'vertical' : undefined,
        'data-orientation': context.orientation,
    });
});
const triggerMixin = createMixin((handle) => {
    let triggerRef = null;
    let context = getTabsContext(handle);
    handle.queueTask((node) => {
        triggerRef = node;
    });
    return (options, props) => {
        let disabled = options.disabled === true || props.disabled === true;
        context.registerTab({
            disabled,
            getNode() {
                return triggerRef;
            },
            value: options.value,
        });
        return [
            attrs({
                id: context.getTriggerId(options.value),
                role: 'tab',
                tabIndex: !disabled && context.focusableValue === options.value ? 0 : -1,
                'aria-controls': context.getPanelId(options.value),
                'aria-disabled': disabled ? 'true' : undefined,
                'aria-selected': context.value === options.value ? 'true' : 'false',
                'data-orientation': context.orientation,
                'data-selected': context.value === options.value ? 'true' : 'false',
            }),
            pressEvents(),
            !disabled && [
                on(pressEvents.press, () => {
                    context.select(options.value);
                }),
                on('keydown', (event) => {
                    switch (event.key) {
                        case 'ArrowRight':
                            if (context.orientation !== 'horizontal') {
                                return;
                            }
                            event.preventDefault();
                            context.move(options.value, 'next');
                            break;
                        case 'ArrowLeft':
                            if (context.orientation !== 'horizontal') {
                                return;
                            }
                            event.preventDefault();
                            context.move(options.value, 'previous');
                            break;
                        case 'ArrowDown':
                            if (context.orientation !== 'vertical') {
                                return;
                            }
                            event.preventDefault();
                            context.move(options.value, 'next');
                            break;
                        case 'ArrowUp':
                            if (context.orientation !== 'vertical') {
                                return;
                            }
                            event.preventDefault();
                            context.move(options.value, 'previous');
                            break;
                        case 'Home':
                            event.preventDefault();
                            context.move(options.value, 'first');
                            break;
                        case 'End':
                            event.preventDefault();
                            context.move(options.value, 'last');
                            break;
                    }
                }),
            ],
        ];
    };
});
const panelMixin = createMixin((handle) => {
    let context = getTabsContext(handle);
    return (options) => {
        let isSelected = context.value === options.value;
        return [
            attrs({
                id: context.getPanelId(options.value),
                role: 'tabpanel',
                hidden: isSelected ? undefined : true,
                'aria-labelledby': context.getTriggerId(options.value),
                'data-orientation': context.orientation,
                'data-selected': isSelected ? 'true' : 'false',
            }),
            panelVisibilityUtility,
        ];
    };
});
export const Context = TabsProvider;
export const list = listMixin;
export const panel = panelMixin;
export const trigger = triggerMixin;
const tabs = { Context, list, panel, trigger };
export function onTabsChange(handler, captureBoolean) {
    return on(TABS_CHANGE_EVENT, handler, captureBoolean);
}
export function Tabs() {
    return (props) => {
        let { children, ...contextProps } = props;
        return _jsx(tabs.Context, { ...contextProps, children: children });
    };
}
export function TabsList() {
    return (props) => {
        let { children, mix, ...divProps } = props;
        return (_jsx("div", { ...divProps, mix: [listStyle, tabs.list(), mix], children: children }));
    };
}
export function Tab() {
    return (props) => {
        let { children, disabled, mix, type, value, ...buttonProps } = props;
        return (_jsx("button", { ...buttonProps, disabled: disabled ? true : undefined, mix: [button.baseStyle, triggerStyle, tabs.trigger({ disabled, value }), mix], type: type ?? 'button', children: children }));
    };
}
export function TabsPanel() {
    return (props) => {
        let { children, mix, value, ...divProps } = props;
        return (_jsx("div", { ...divProps, mix: [tabs.panel({ value }), mix], children: children }));
    };
}
//# sourceMappingURL=tabs.js.map