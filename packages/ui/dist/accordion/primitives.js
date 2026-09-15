import { attrs, createMixin, on, ref, } from '@remix-run/ui';
const ACCORDION_CHANGE_EVENT = 'rmx:accordion-change';
export class AccordionChangeEvent extends Event {
    accordionType;
    itemValue;
    value;
    constructor(value, init) {
        super(ACCORDION_CHANGE_EVENT, {
            bubbles: true,
        });
        this.accordionType = init.accordionType;
        this.itemValue = init.itemValue;
        this.value = value;
    }
}
function isMultipleProps(props) {
    return props?.type === 'multiple';
}
function getAccordionContext(handle) {
    return handle.context.get(AccordionProvider);
}
function getAccordionItemContext(handle) {
    return handle.context.get(AccordionItemProvider);
}
function AccordionProvider(handle) {
    let rootNode = null;
    let registeredItems = [];
    let uncontrolledSingleValue = null;
    let uncontrolledMultipleValue = [];
    let hasInitializedSingle = false;
    let hasInitializedMultiple = false;
    function getType() {
        return isMultipleProps(handle.props) ? 'multiple' : 'single';
    }
    function getSingleValue() {
        if (isMultipleProps(handle.props)) {
            return null;
        }
        if (handle.props.value !== undefined) {
            return handle.props.value;
        }
        if (!hasInitializedSingle) {
            uncontrolledSingleValue = handle.props.defaultValue ?? null;
            hasInitializedSingle = true;
        }
        return uncontrolledSingleValue;
    }
    function getMultipleValue() {
        if (!isMultipleProps(handle.props)) {
            return [];
        }
        if (handle.props.value !== undefined) {
            return handle.props.value;
        }
        if (!hasInitializedMultiple) {
            uncontrolledMultipleValue = [...(handle.props.defaultValue ?? [])];
            hasInitializedMultiple = true;
        }
        return uncontrolledMultipleValue;
    }
    function isOpen(value) {
        if (getType() === 'multiple') {
            return getMultipleValue().includes(value);
        }
        return getSingleValue() === value;
    }
    function dispatchChange(itemValue, value) {
        rootNode?.dispatchEvent(new AccordionChangeEvent(value, {
            accordionType: getType(),
            itemValue,
        }));
    }
    function toggleItem(itemValue) {
        if (handle.props.disabled) {
            return;
        }
        if (isMultipleProps(handle.props)) {
            let currentValue = getMultipleValue();
            let nextValue = currentValue.includes(itemValue)
                ? currentValue.filter((value) => value !== itemValue)
                : [...currentValue, itemValue];
            if (handle.props.value === undefined) {
                uncontrolledMultipleValue = nextValue;
                void handle.update();
            }
            handle.props.onValueChange?.(nextValue);
            dispatchChange(itemValue, nextValue);
            return;
        }
        let isCurrentItemOpen = getSingleValue() === itemValue;
        if (isCurrentItemOpen && !(handle.props.collapsible ?? true)) {
            return;
        }
        let nextValue = isCurrentItemOpen ? null : itemValue;
        if (handle.props.value === undefined) {
            uncontrolledSingleValue = nextValue;
            void handle.update();
        }
        handle.props.onValueChange?.(nextValue);
        dispatchChange(itemValue, nextValue);
    }
    function focusItem(itemValue, direction) {
        let items = registeredItems.filter((item) => !item.disabled && item.getTriggerNode() !== null);
        if (items.length === 0) {
            return;
        }
        let currentIndex = items.findIndex((item) => item.value === itemValue);
        let targetIndex = 0;
        switch (direction) {
            case 'first':
                targetIndex = 0;
                break;
            case 'last':
                targetIndex = items.length - 1;
                break;
            case 'previous':
                targetIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                break;
            case 'next':
                targetIndex =
                    currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1;
                break;
        }
        items[targetIndex]?.getTriggerNode()?.focus();
    }
    function registerItem(item) {
        registeredItems.push(item);
    }
    function getTriggerId(value) {
        return registeredItems.find((item) => item.value === value)?.getTriggerNode()?.id;
    }
    function getPanelId(value) {
        return `${handle.id}-${value}-panel`;
    }
    handle.context.set({
        get collapsible() {
            return getType() === 'multiple'
                ? true
                : (handle.props.collapsible ?? true);
        },
        get disabled() {
            return handle.props.disabled ?? false;
        },
        focusItem,
        getPanelId,
        getTriggerId,
        get headingLevel() {
            return handle.props.headingLevel ?? 3;
        },
        isOpen,
        registerItem,
        registerRoot(node) {
            rootNode = node;
        },
        toggleItem,
        get type() {
            return getType();
        },
        unregisterRoot(node) {
            if (rootNode === node) {
                rootNode = null;
            }
        },
    });
    return () => {
        registeredItems = [];
        return handle.props.children;
    };
}
function AccordionItemProvider(handle) {
    let triggerNode = null;
    let triggerId = `${handle.id}-trigger`;
    let panelId = `${handle.id}-panel`;
    let disabled = false;
    let headingLevel = 3;
    let lockedOpen = false;
    let open = false;
    let value = handle.props.value;
    handle.context.set({
        get disabled() {
            return disabled;
        },
        get headingLevel() {
            return headingLevel;
        },
        get lockedOpen() {
            return lockedOpen;
        },
        get open() {
            return open;
        },
        get panelId() {
            return panelId;
        },
        setTriggerNode(node) {
            triggerNode = node;
        },
        get triggerId() {
            return triggerId;
        },
        get value() {
            return value;
        },
    });
    return () => {
        let accordion = getAccordionContext(handle);
        value = handle.props.value;
        disabled = accordion.disabled || handle.props.disabled === true;
        headingLevel = accordion.headingLevel;
        open = accordion.isOpen(handle.props.value);
        lockedOpen = accordion.type === 'single' && !accordion.collapsible && open;
        accordion.registerItem({
            disabled,
            getTriggerNode: () => triggerNode,
            value: handle.props.value,
        });
        return handle.props.children;
    };
}
const rootMixin = createMixin((handle) => {
    let context = getAccordionContext(handle);
    let rootNode = null;
    handle.queueTask((node, signal) => {
        rootNode = node;
        context.registerRoot(node);
        signal.addEventListener('abort', () => {
            if (rootNode === node) {
                rootNode = null;
            }
            context.unregisterRoot(node);
        });
    });
    return () => attrs({
        'data-disabled': context.disabled ? '' : undefined,
        'data-type': context.type,
    });
});
const itemMixin = createMixin((handle) => {
    let item = getAccordionItemContext(handle);
    return () => attrs({
        'data-disabled': item.disabled ? '' : undefined,
        'data-state': item.open ? 'open' : 'closed',
    });
});
const triggerMixin = createMixin((handle) => {
    let accordion = getAccordionContext(handle);
    let item = getAccordionItemContext(handle);
    return (options, props = options) => {
        options = props === options ? undefined : options;
        let disabled = item.disabled || options?.disabled === true || props.disabled === true;
        let toggleItem = () => {
            if (disabled || item.lockedOpen) {
                return;
            }
            accordion.toggleItem(item.value);
        };
        return [
            attrs({
                'aria-controls': item.panelId,
                'aria-disabled': item.lockedOpen ? true : undefined,
                'aria-expanded': item.open,
                'data-state': item.open ? 'open' : 'closed',
                disabled: disabled ? true : undefined,
                id: item.triggerId,
            }),
            ref((node) => {
                item.setTriggerNode(node);
            }),
            on('click', toggleItem),
            on('keydown', (event) => {
                switch (event.key) {
                    case 'ArrowDown':
                        event.preventDefault();
                        accordion.focusItem(item.value, 'next');
                        break;
                    case 'ArrowUp':
                        event.preventDefault();
                        accordion.focusItem(item.value, 'previous');
                        break;
                    case 'Home':
                        event.preventDefault();
                        accordion.focusItem(item.value, 'first');
                        break;
                    case 'End':
                        event.preventDefault();
                        accordion.focusItem(item.value, 'last');
                        break;
                }
            }),
        ];
    };
});
const contentMixin = createMixin((handle) => {
    let item = getAccordionItemContext(handle);
    return () => attrs({
        'aria-hidden': item.open ? undefined : true,
        'aria-labelledby': item.triggerId,
        'data-state': item.open ? 'open' : 'closed',
        id: item.panelId,
        inert: item.open ? undefined : true,
    });
});
export const Context = AccordionProvider;
export const ItemContext = AccordionItemProvider;
export const content = contentMixin;
export const item = itemMixin;
export const root = rootMixin;
export const trigger = triggerMixin;
export function onAccordionChange(handler, captureBoolean) {
    return on(ACCORDION_CHANGE_EVENT, handler, captureBoolean);
}
//# sourceMappingURL=primitives.js.map