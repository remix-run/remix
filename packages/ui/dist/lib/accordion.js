import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/component/jsx-runtime";
import { css, createElement, on, pressEvents, ref, } from '@remix-run/component';
import { Glyph } from "./glyph.js";
import { ui } from "./theme.js";
export let accordionChangeEventType = 'rmx:accordion-change';
export class AccordionChangeEvent extends Event {
    accordionType;
    itemValue;
    value;
    constructor(value, init) {
        super(accordionChangeEventType, {
            bubbles: true,
        });
        this.accordionType = init.accordionType;
        this.itemValue = init.itemValue;
        this.value = value;
    }
}
let accordionPanelClipCss = css({
    minHeight: 0,
    overflow: 'hidden',
});
function isMultipleProps(props) {
    return props?.type === 'multiple';
}
function AccordionComponentImpl(handle) {
    let rootNode = null;
    let registeredItems = [];
    let currentProps = null;
    let uncontrolledSingleValue = null;
    let uncontrolledMultipleValue = [];
    let hasInitializedSingle = false;
    let hasInitializedMultiple = false;
    let getType = () => (isMultipleProps(currentProps) ? 'multiple' : 'single');
    let getSingleValue = () => {
        if (!currentProps || isMultipleProps(currentProps)) {
            return null;
        }
        if (currentProps.value !== undefined) {
            return currentProps.value;
        }
        if (!hasInitializedSingle) {
            uncontrolledSingleValue = currentProps.defaultValue ?? null;
            hasInitializedSingle = true;
        }
        return uncontrolledSingleValue;
    };
    let getMultipleValue = () => {
        if (!isMultipleProps(currentProps)) {
            return [];
        }
        if (currentProps.value !== undefined) {
            return currentProps.value;
        }
        if (!hasInitializedMultiple) {
            uncontrolledMultipleValue = [...(currentProps.defaultValue ?? [])];
            hasInitializedMultiple = true;
        }
        return uncontrolledMultipleValue;
    };
    let isOpen = (value) => {
        if (getType() === 'multiple') {
            return getMultipleValue().includes(value);
        }
        return getSingleValue() === value;
    };
    let dispatchChange = (itemValue, value) => {
        rootNode?.dispatchEvent(new AccordionChangeEvent(value, {
            accordionType: getType(),
            itemValue,
        }));
    };
    let toggleItem = (itemValue) => {
        if (!currentProps || currentProps.disabled) {
            return;
        }
        if (isMultipleProps(currentProps)) {
            let currentValue = getMultipleValue();
            let nextValue = currentValue.includes(itemValue)
                ? currentValue.filter((value) => value !== itemValue)
                : [...currentValue, itemValue];
            if (currentProps.value === undefined) {
                uncontrolledMultipleValue = nextValue;
                void handle.update();
            }
            currentProps.onValueChange?.(nextValue);
            dispatchChange(itemValue, nextValue);
            return;
        }
        let isCurrentItemOpen = getSingleValue() === itemValue;
        if (isCurrentItemOpen && !(currentProps.collapsible ?? true)) {
            return;
        }
        let nextValue = isCurrentItemOpen ? null : itemValue;
        if (currentProps.value === undefined) {
            uncontrolledSingleValue = nextValue;
            void handle.update();
        }
        currentProps.onValueChange?.(nextValue);
        dispatchChange(itemValue, nextValue);
    };
    let focusItem = (itemValue, direction) => {
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
    };
    let registerItem = (item) => {
        registeredItems.push(item);
    };
    let getTriggerId = (value) => registeredItems.find((item) => item.value === value)?.getTriggerNode()?.id;
    let getPanelId = (value) => `${handle.id}-${value}-panel`;
    return (props) => {
        let collapsible = 'collapsible' in props ? props.collapsible : undefined;
        let { children, defaultValue, disabled, headingLevel, mix, onValueChange, type, value, ...divProps } = props;
        void defaultValue;
        void onValueChange;
        void value;
        currentProps = props;
        registeredItems = [];
        handle.context.set({
            collapsible: type === 'multiple' ? true : (collapsible ?? true),
            disabled: disabled ?? false,
            focusItem,
            getPanelId,
            getTriggerId,
            headingLevel: headingLevel ?? 3,
            isOpen,
            registerItem,
            toggleItem,
            type: type ?? 'single',
        });
        return (_jsx("div", { ...divProps, "data-disabled": disabled ? '' : undefined, "data-type": type ?? 'single', mix: [
                ui.accordion.root,
                ref((node) => {
                    rootNode = node;
                }),
                ...(mix ?? []),
            ], children: children }));
    };
}
export let Accordion = Object.assign(AccordionComponentImpl, {
    change: accordionChangeEventType,
});
export function AccordionItem(handle) {
    let triggerNode = null;
    let triggerId = `${handle.id}-trigger`;
    let panelId = `${handle.id}-panel`;
    return (props) => {
        let { children, disabled: itemDisabled, mix, value, ...divProps } = props;
        let accordion = handle.context.get(Accordion);
        let disabled = accordion.disabled || itemDisabled === true;
        let open = accordion.isOpen(value);
        let lockedOpen = accordion.type === 'single' && !accordion.collapsible && open;
        accordion.registerItem({
            disabled,
            getTriggerNode: () => triggerNode,
            value,
        });
        handle.context.set({
            disabled,
            headingLevel: accordion.headingLevel,
            lockedOpen,
            open,
            panelId,
            setTriggerNode(node) {
                triggerNode = node;
            },
            triggerId,
            value,
        });
        return (_jsx("div", { ...divProps, "data-disabled": disabled ? '' : undefined, "data-state": open ? 'open' : 'closed', mix: [ui.accordion.item, ...(mix ?? [])], children: children }));
    };
}
export function AccordionTrigger(handle) {
    return (props) => {
        let accordion = handle.context.get(Accordion);
        let item = handle.context.get(AccordionItem);
        let headingTag = `h${item.headingLevel}`;
        let disabled = item.disabled || props.disabled === true;
        let { children, indicator, mix, type, ...buttonProps } = props;
        let button = (_jsxs("button", { ...buttonProps, "aria-controls": item.panelId, "aria-disabled": item.lockedOpen ? true : undefined, "aria-expanded": item.open, "data-state": item.open ? 'open' : 'closed', disabled: disabled ? true : undefined, id: item.triggerId, mix: [
                ui.accordion.trigger,
                pressEvents(),
                ref((node) => {
                    item.setTriggerNode(node);
                }),
                on(pressEvents.press, () => {
                    if (disabled || item.lockedOpen) {
                        return;
                    }
                    accordion.toggleItem(item.value);
                }),
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
                ...(mix ?? []),
            ], type: type ?? 'button', children: [_jsx("span", { children: children }), indicator === null ? null : (_jsx("span", { "data-rmx-accordion-indicator": "", "data-state": item.open ? 'open' : 'closed', mix: ui.accordion.indicator, children: indicator ?? _jsx(Glyph, { name: "chevronRight" }) }))] }));
        return createElement(headingTag, {}, button);
    };
}
export function AccordionContent(handle) {
    return (props) => {
        let item = handle.context.get(AccordionItem);
        let { children, mix, ...panelProps } = props;
        return (_jsx("div", { ...panelProps, "aria-hidden": item.open ? undefined : true, "aria-labelledby": item.triggerId, "data-state": item.open ? 'open' : 'closed', id: item.panelId, inert: item.open ? undefined : true, mix: [ui.accordion.panel, mix ?? []], children: _jsx("div", { mix: accordionPanelClipCss, children: _jsx("div", { mix: ui.accordion.body, children: children }) }) }));
    };
}
//# sourceMappingURL=accordion.js.map