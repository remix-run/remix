import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx createElement
import { attrs, createElement, createMixin, css, on, ref, } from '@remix-run/component';
import * as button from "../button/button.js";
import { Glyph } from "../glyph/glyph.js";
import * as listbox from "../listbox/listbox.js";
import * as popover from "../popover/popover.js";
import { theme } from "../theme/theme.js";
import { hiddenTypeahead } from "../typeahead/typeahead-mixin.js";
import { onKeyDown } from "../keydown/keydown.js";
import { waitForCssTransition } from "../utils/wait-for-css-transition.js";
import { wait } from "../utils/wait.js";
const SELECT_CHANGE_EVENT = 'rmx:select-change';
const LABEL_SWAP_DELAY_MS = 75;
export class SelectChangeEvent extends Event {
    label;
    optionId;
    value;
    constructor({ label, optionId, value, }) {
        super(SELECT_CHANGE_EVENT, { bubbles: true });
        this.label = label;
        this.optionId = optionId;
        this.value = value;
    }
}
var State;
(function (State) {
    State["Initializing"] = "initializing";
    State["Closed"] = "closed";
    State["Open"] = "open";
    State["Selecting"] = "selecting";
})(State || (State = {}));
function SelectProvider(handle) {
    let triggerRef;
    let listboxRef;
    let surfaceRef;
    let popoverContextRef;
    let props = { defaultLabel: '' };
    let state = State.Initializing;
    let value = null;
    let activeValue = null;
    let activeId = undefined;
    let selectedId = undefined;
    let selectedLabel = '';
    let displayedLabel = '';
    let pendingChange = null;
    let listId = `${handle.id}-list`;
    function open() {
        if (state !== State.Closed || props.disabled)
            return;
        state = State.Open;
        activeValue = value;
        handle.update();
    }
    function syncPopoverMinWidth() {
        if (state !== State.Open || !surfaceRef || !triggerRef) {
            return;
        }
        surfaceRef.style.minWidth = `${triggerRef.offsetWidth}px`;
    }
    function getPopoverAnchorOptions() {
        return {
            placement: 'left',
            inset: true,
            relativeTo: selectedId ? `#${selectedId}` : '[role="option"]',
        };
    }
    function syncPopoverContext() {
        if (!popoverContextRef) {
            return;
        }
        popoverContextRef.hideFocusTarget = triggerRef ?? null;
        popoverContextRef.anchor = triggerRef
            ? {
                node: triggerRef,
                options: getPopoverAnchorOptions(),
            }
            : null;
    }
    function close() {
        if (state !== State.Open)
            return;
        state = State.Closed;
        handle.update();
    }
    function setSelectedOption(nextValue, option, syncDisplayedLabel = false) {
        value = nextValue;
        activeValue = nextValue;
        activeId = option?.id;
        selectedId = option?.id;
        selectedLabel = option ? option.label : props.defaultLabel;
        syncPopoverContext();
        if (syncDisplayedLabel) {
            displayedLabel = selectedLabel;
        }
    }
    function getPendingChange(nextValue, option) {
        if (!option || value === nextValue) {
            return null;
        }
        return {
            label: option.label,
            optionId: option.id,
            value: option.value,
        };
    }
    function dispatchChange(change) {
        if (!change) {
            return;
        }
        let target = triggerRef ?? surfaceRef;
        target?.dispatchEvent(new SelectChangeEvent(change));
    }
    function selectOption(nextValue, option) {
        if (state !== State.Open)
            return;
        pendingChange = getPendingChange(nextValue, option);
        setSelectedOption(nextValue, option);
        handle.update();
    }
    async function settleSelectedOption() {
        if (state !== State.Open)
            return;
        let change = pendingChange;
        pendingChange = null;
        state = State.Selecting;
        if (!surfaceRef) {
            displayedLabel = selectedLabel;
            state = State.Closed;
            let signal = await handle.update();
            if (signal.aborted)
                return;
            dispatchChange(change);
            return;
        }
        await Promise.all([handle.update(), waitForCssTransition(surfaceRef, handle.signal)]);
        await wait(LABEL_SWAP_DELAY_MS); // UX delay label swap for clear value change
        if (handle.signal.aborted)
            return;
        displayedLabel = selectedLabel;
        state = State.Closed;
        let signal = await handle.update();
        if (signal.aborted)
            return;
        dispatchChange(change);
    }
    function selectTypeaheadMatch(text) {
        if (state !== State.Closed || props.disabled)
            return;
        let option = listboxRef?.matchSearchText(text, value);
        if (!option)
            return;
        let change = getPendingChange(option.value, option);
        pendingChange = null;
        setSelectedOption(option.value, option, true);
        void handle.update().then((signal) => {
            if (signal.aborted)
                return;
            dispatchChange(change);
        });
    }
    function highlightOption(nextActiveValue, option) {
        if (state !== State.Open)
            return;
        activeValue = nextActiveValue;
        activeId = option?.id;
        handle.update();
    }
    handle.context.set({
        get activeId() {
            return activeId;
        },
        get disabled() {
            return !!props.disabled;
        },
        get displayedLabel() {
            return displayedLabel;
        },
        get isExpanded() {
            return state === State.Open || state === State.Selecting;
        },
        get isOpen() {
            return state === State.Open;
        },
        get listId() {
            return listId;
        },
        get name() {
            return props.name;
        },
        get selectedId() {
            return selectedId;
        },
        get value() {
            return value;
        },
        close,
        open,
        registerSurface(node) {
            surfaceRef = node;
        },
        registerTrigger(node) {
            triggerRef = node;
            syncPopoverContext();
        },
        registerPopoverContext(context) {
            popoverContextRef = context;
            syncPopoverContext();
        },
        selectTypeaheadMatch,
        syncPopoverMinWidth,
        unregisterSurface(node) {
            if (surfaceRef === node) {
                surfaceRef = undefined;
            }
        },
        unregisterPopoverContext(context) {
            if (popoverContextRef !== context) {
                return;
            }
            popoverContextRef.anchor = null;
            popoverContextRef.hideFocusTarget = null;
            popoverContextRef = undefined;
        },
        unregisterTrigger(node) {
            if (triggerRef === node) {
                triggerRef = undefined;
                syncPopoverContext();
            }
        },
    });
    return (nextProps) => {
        props = nextProps;
        if (state === State.Initializing) {
            selectedLabel = displayedLabel = props.defaultLabel;
            value = props.defaultValue ?? null;
            activeValue = value;
            state = State.Closed;
            handle.queueTask(() => {
                if (selectedId || !surfaceRef) {
                    return;
                }
                let selected = surfaceRef.querySelector(`[aria-selected="true"]`);
                if (selected && !selectedId) {
                    selectedId = selected.id;
                    syncPopoverContext();
                    handle.update();
                }
            });
        }
        return (_jsx(listbox.Context, { flashSelection: true, ref: (nextListboxRef) => {
                listboxRef = nextListboxRef;
            }, value: value, activeValue: activeValue, onSelectSettled: settleSelectedOption, onSelect: selectOption, onHighlight: highlightOption, selectionFlashAttribute: "data-select-flash", children: props.children }));
    };
}
function getSelectContext(handle) {
    return handle.context.get(SelectProvider);
}
const triggerMixin = createMixin((handle) => {
    let context = getSelectContext(handle);
    return (props) => [
        attrs({
            'aria-haspopup': 'listbox',
            'aria-expanded': context.isExpanded ? 'true' : 'false',
            'aria-controls': context.listId,
            'aria-describedby': context.selectedId,
            disabled: context.disabled ? true : props.disabled,
        }),
        ref((node, signal) => {
            context.registerTrigger(node);
            signal.addEventListener('abort', () => {
                context.unregisterTrigger(node);
            });
        }),
        hiddenTypeahead((text) => {
            context.selectTypeaheadMatch(text);
        }),
        on('click', () => {
            context.open();
        }),
        onKeyDown('ArrowDown', () => {
            context.open();
        }),
        onKeyDown('ArrowUp', () => {
            context.open();
        }),
    ];
});
const popoverMixin = createMixin((handle) => {
    let context = getSelectContext(handle);
    let popoverState = handle.context.get(popover.Context);
    return () => [
        ref((node, signal) => {
            context.registerSurface(node);
            context.registerPopoverContext(popoverState);
            signal.addEventListener('abort', () => {
                context.unregisterSurface(node);
                context.unregisterPopoverContext(popoverState);
            });
        }),
        popover.surface({
            open: context.isOpen,
            onHide: context.close,
        }),
        on('beforetoggle', (event) => {
            if (event.newState === 'open') {
                context.syncPopoverMinWidth();
            }
        }),
    ];
});
const listMixin = createMixin((handle) => {
    let context = getSelectContext(handle);
    return () => [
        attrs({
            id: context.listId,
            'aria-activedescendant': context.activeId,
        }),
        popover.focusOnShow(),
        listbox.list(),
    ];
});
const hiddenInputMixin = createMixin((handle) => {
    let context = getSelectContext(handle);
    return () => attrs({
        disabled: context.disabled ? true : undefined,
        name: context.name,
        type: 'hidden',
        value: context.value ?? '',
    });
});
const selectTriggerCss = css({
    minHeight: theme.control.height.sm,
    width: '100%',
    paddingInline: theme.space.md,
    paddingInlineEnd: theme.space.sm,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: theme.space.sm,
    borderRadius: theme.radius.md,
    backgroundImage: 'none',
    border: '0.5px solid transparent',
    boxShadow: 'none',
    fontSize: theme.fontSize.xs,
    textAlign: 'left',
    backgroundColor: theme.surface.lvl3,
    color: theme.colors.text.secondary,
    '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible': {
        backgroundColor: theme.surface.lvl4,
        color: theme.colors.text.primary,
    },
    '&:active': {
        backgroundColor: theme.surface.lvl3,
    },
    '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
    },
    '&:disabled': {
        opacity: 0.6,
    },
});
export const triggerStyle = selectTriggerCss;
export const Context = SelectProvider;
export const hiddenInput = hiddenInputMixin;
export const list = listMixin;
export const option = listbox.option;
export { popoverMixin as popover };
export const trigger = triggerMixin;
const select = {
    Context,
    hiddenInput,
    list,
    option,
    popover: popoverMixin,
    trigger,
};
export function onSelectChange(handler, captureBoolean) {
    return on(SELECT_CHANGE_EVENT, handler, captureBoolean);
}
function SelectLabel(handle) {
    let context = getSelectContext(handle);
    return () => _jsx("span", { mix: button.labelStyle, children: context.displayedLabel });
}
export function Select() {
    return (props) => {
        let { children, defaultLabel, defaultValue, disabled, name, mix, ...buttonProps } = props;
        return (_jsxs(select.Context, { defaultLabel: defaultLabel, defaultValue: defaultValue, disabled: disabled, name: name, children: [_jsxs("button", { ...buttonProps, mix: [button.baseStyle, triggerStyle, select.trigger(), mix], children: [_jsx(SelectLabel, {}), _jsx(Glyph, { mix: button.iconStyle, name: "chevronVertical" })] }), _jsx(popover.Context, { children: _jsx("div", { mix: [popover.surfaceStyle, select.popover()], children: _jsx("div", { mix: [popover.contentStyle, listbox.listStyle, select.list()], children: children }) }) }), name && _jsx("input", { mix: select.hiddenInput() })] }));
    };
}
export function Option() {
    return (props) => {
        let { label, value, disabled, textValue, children, mix, ...divProps } = props;
        return (_jsxs("div", { ...divProps, mix: [listbox.optionStyle, select.option({ value, label, disabled, textValue }), mix], children: [_jsx(Glyph, { mix: listbox.glyphStyle, name: "check" }), _jsx("span", { mix: listbox.labelStyle, children: children ?? props.label })] }));
    };
}
//# sourceMappingURL=select.js.map