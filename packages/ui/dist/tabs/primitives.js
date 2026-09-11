import { attrs, createMixin, on, ref, } from '@remix-run/ui';
const TABS_CHANGE_EVENT = 'rmx:tabs-change';
export class TabsChangeEvent extends Event {
    activeTab;
    previousActiveTab;
    constructor(activeTab, previousActiveTab) {
        super(TABS_CHANGE_EVENT, {
            bubbles: true,
        });
        this.activeTab = activeTab;
        this.previousActiveTab = previousActiveTab;
    }
}
function encodeIdPart(value) {
    return encodeURIComponent(value).replace(/%/g, '-');
}
function getTabState(active) {
    return active ? 'active' : 'inactive';
}
function getTabsContext(handle) {
    return handle.context.get(TabsProvider);
}
function TabsProvider(handle) {
    let rootNode = null;
    let renderedTabs = [];
    let uncontrolledActiveTab = null;
    let hasInitialized = false;
    function getActiveTab() {
        if (handle.props.activeTab !== undefined) {
            return handle.props.activeTab;
        }
        if (!hasInitialized) {
            uncontrolledActiveTab = handle.props.defaultActiveTab ?? null;
            hasInitialized = true;
        }
        return uncontrolledActiveTab;
    }
    function getRegisteredTab(name) {
        return renderedTabs.find((tab) => tab.name === name);
    }
    function dispatchChange(activeTab, previousActiveTab) {
        rootNode?.dispatchEvent(new TabsChangeEvent(activeTab, previousActiveTab));
    }
    function activateTab(name) {
        if (handle.props.disabled) {
            return;
        }
        let tab = getRegisteredTab(name);
        if (tab?.disabled) {
            return;
        }
        let previousActiveTab = getActiveTab();
        if (previousActiveTab === name) {
            return;
        }
        if (handle.props.activeTab === undefined) {
            uncontrolledActiveTab = name;
            void handle.update();
        }
        handle.props.onActiveTabChange?.(name);
        dispatchChange(name, previousActiveTab);
    }
    function getFocusableTabs() {
        return renderedTabs.filter((tab) => !tab.disabled && tab.getTabNode() !== null);
    }
    function activateTabInDirection(name, direction) {
        let tabs = getFocusableTabs();
        if (tabs.length === 0) {
            return;
        }
        let currentIndex = tabs.findIndex((tab) => tab.name === name);
        let targetIndex = 0;
        switch (direction) {
            case 'first':
                targetIndex = 0;
                break;
            case 'last':
                targetIndex = tabs.length - 1;
                break;
            case 'previous':
                targetIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
                break;
            case 'next':
                targetIndex = currentIndex === -1 || currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
                break;
        }
        let targetTab = tabs[targetIndex];
        targetTab?.getTabNode()?.focus();
        if (targetTab) {
            activateTab(targetTab.name);
        }
    }
    function getTabId(name) {
        return `${handle.id}-${encodeIdPart(name)}-tab`;
    }
    function getPanelId(name) {
        return `${handle.id}-${encodeIdPart(name)}-panel`;
    }
    function registerTab(tab) {
        renderedTabs.push(tab);
        if (handle.props.activeTab === undefined && getActiveTab() === null && !tab.disabled) {
            uncontrolledActiveTab = tab.name;
        }
    }
    handle.context.set({
        get activeTab() {
            return getActiveTab();
        },
        get disabled() {
            return handle.props.disabled ?? false;
        },
        activateTab,
        activateTabInDirection,
        getPanelId,
        getTabId,
        isActiveTab(name) {
            return getActiveTab() === name;
        },
        registerRoot(node) {
            rootNode = node;
        },
        registerTab,
        unregisterRoot(node) {
            if (rootNode === node) {
                rootNode = null;
            }
        },
    });
    return () => {
        renderedTabs = [];
        return handle.props.children;
    };
}
const rootMixin = createMixin((handle) => {
    let context = getTabsContext(handle);
    handle.queueTask((node, signal) => {
        context.registerRoot(node);
        signal.addEventListener('abort', () => {
            context.unregisterRoot(node);
        });
    });
    return () => attrs({
        'data-disabled': context.disabled ? '' : undefined,
    });
});
const listMixin = createMixin((handle) => {
    let context = getTabsContext(handle);
    return () => attrs({
        'aria-disabled': context.disabled ? true : undefined,
        role: 'tablist',
    });
});
const tabMixin = createMixin((handle, hostType) => {
    let context = getTabsContext(handle);
    let tabNode = null;
    return (options, props) => {
        let disabled = context.disabled || options.disabled === true || props.disabled === true;
        context.registerTab({
            disabled,
            getTabNode: () => tabNode,
            name: options.name,
        });
        let active = context.isActiveTab(options.name);
        return [
            attrs({
                'aria-controls': context.getPanelId(options.name),
                'aria-selected': active ? 'true' : 'false',
                'data-state': getTabState(active),
                disabled: disabled ? true : undefined,
                id: context.getTabId(options.name),
                role: 'tab',
                tabIndex: active && !disabled ? 0 : -1,
                type: hostType === 'button' ? 'button' : undefined,
            }),
            ref((node, signal) => {
                tabNode = node;
                signal.addEventListener('abort', () => {
                    if (tabNode === node) {
                        tabNode = null;
                    }
                });
            }),
            on('click', () => {
                context.activateTab(options.name);
            }),
            on('keydown', (event) => {
                switch (event.key) {
                    case 'ArrowDown':
                    case 'ArrowRight':
                        event.preventDefault();
                        context.activateTabInDirection(options.name, 'next');
                        break;
                    case 'ArrowUp':
                    case 'ArrowLeft':
                        event.preventDefault();
                        context.activateTabInDirection(options.name, 'previous');
                        break;
                    case 'Home':
                        event.preventDefault();
                        context.activateTabInDirection(options.name, 'first');
                        break;
                    case 'End':
                        event.preventDefault();
                        context.activateTabInDirection(options.name, 'last');
                        break;
                    case 'Enter':
                    case ' ':
                        event.preventDefault();
                        context.activateTab(options.name);
                        break;
                }
            }),
        ];
    };
});
const panelMixin = createMixin((handle) => {
    let context = getTabsContext(handle);
    return (options) => {
        let active = context.isActiveTab(options.name);
        return attrs({
            'aria-labelledby': context.getTabId(options.name),
            'data-state': getTabState(active),
            hidden: active ? undefined : true,
            id: context.getPanelId(options.name),
            inert: active ? undefined : true,
            role: 'tabpanel',
        });
    };
});
export const Context = TabsProvider;
export const list = listMixin;
export const panel = panelMixin;
export const root = rootMixin;
export const tab = tabMixin;
export function onTabsChange(handler, captureBoolean) {
    return on(TABS_CHANGE_EVENT, handler, captureBoolean);
}
//# sourceMappingURL=primitives.js.map