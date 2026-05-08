import { attrs, createMixin, css, on, } from '@remix-run/ui';
import { theme } from "../../theme/theme.js";
import { hiddenTypeahead, matchNextItemBySearchText, } from "../../interactions/typeahead/typeahead-mixin.js";
import { flashAttribute } from "../../utils/flash-attribute.js";
var NavigationStrategy;
(function (NavigationStrategy) {
    NavigationStrategy[NavigationStrategy["Next"] = 0] = "Next";
    NavigationStrategy[NavigationStrategy["Previous"] = 1] = "Previous";
    NavigationStrategy[NavigationStrategy["First"] = 2] = "First";
    NavigationStrategy[NavigationStrategy["Last"] = 3] = "Last";
})(NavigationStrategy || (NavigationStrategy = {}));
var State;
(function (State) {
    State["Idle"] = "idle";
    State["Selecting"] = "selecting";
})(State || (State = {}));
const listCss = css({
    display: 'flex',
    flexDirection: 'column',
    outline: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    '--rmx-ui-item-inset': theme.space.sm,
    '--rmx-ui-item-indicator-gap': theme.space.xs,
    '--rmx-ui-item-indicator-width': theme.fontSize.sm,
});
const itemCss = css({
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    alignItems: 'center',
    width: '100%',
    minHeight: theme.control.height.md,
    padding: `${theme.space.xs} ${theme.space.sm}`,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.normal,
    lineHeight: theme.lineHeight.normal,
    textAlign: 'left',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    '&:focus': {
        outline: 'none',
    },
    '&[data-highlighted="true"]': {
        backgroundColor: theme.colors.action.primary.background,
        color: theme.colors.action.primary.foreground,
    },
    '&[aria-disabled="true"]': {
        opacity: 0.5,
    },
    scrollMarginBlock: theme.space.xs,
    '--rmx-listbox-option-indicator-opacity': '0',
    '&[hidden]': {
        display: 'none',
    },
    '&[data-listbox-flash="true"], &[data-select-flash="true"], &[data-combobox-flash="true"]': {
        backgroundColor: 'transparent',
        color: theme.colors.text.primary,
    },
    '&[aria-selected="true"]': {
        '--rmx-listbox-option-indicator-opacity': '1',
    },
});
const itemGlyphCss = css({
    gridColumn: '1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1em',
    height: '1em',
    color: 'currentColor',
    flexShrink: 0,
    opacity: 'var(--rmx-listbox-option-indicator-opacity)',
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
});
const itemLabelCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    paddingInline: theme.space.xs,
    WebkitUserSelect: 'none',
});
export const listStyle = listCss;
export const optionStyle = itemCss;
export const glyphStyle = itemGlyphCss;
export const labelStyle = itemLabelCss;
function ListboxProvider(handle) {
    let options = [];
    let state = State.Idle;
    function getOption(value) {
        return options.find((option) => option.value === value);
    }
    function isVisibleOption(option) {
        return !!option?.node?.isConnected && !option.hidden;
    }
    function isInteractableOption(option) {
        return isVisibleOption(option) && !option?.disabled;
    }
    function getInteractableOptions() {
        return options.filter(isInteractableOption);
    }
    function scrollOptionIntoView(option) {
        if (!isVisibleOption(option)) {
            return;
        }
        option.node.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
        });
    }
    function findSearchMatch(text, fromValue = handle.props.activeValue) {
        let interactableOptions = getInteractableOptions();
        let fromIndex = interactableOptions.findIndex((option) => option.value === fromValue);
        return matchNextItemBySearchText(text, interactableOptions, {
            fromIndex,
            getSearchValues: (option) => option.textValue ?? option.label,
        });
    }
    let context;
    let ref = {
        get active() {
            return getOption(handle.props.activeValue);
        },
        get options() {
            return options;
        },
        get selected() {
            return getOption(handle.props.value);
        },
        highlight(value) {
            context.highlight(value);
        },
        highlightSearchMatch(text) {
            context.highlightSearchMatch(text);
        },
        matchSearchText(text, fromValue = handle.props.activeValue) {
            return findSearchMatch(text, fromValue);
        },
        navigateFirst() {
            context.navigate(NavigationStrategy.First);
        },
        navigateLast() {
            context.navigate(NavigationStrategy.Last);
        },
        navigateNext() {
            context.navigate(NavigationStrategy.Next);
        },
        navigatePrevious() {
            context.navigate(NavigationStrategy.Previous);
        },
        scrollActiveOptionIntoView() {
            context.scrollActiveOptionIntoView();
        },
        select(value) {
            return context.select(value);
        },
        selectActive() {
            return context.select(handle.props.activeValue);
        },
    };
    handle.queueTask(() => {
        handle.props.ref?.(ref);
    });
    context = {
        get value() {
            return handle.props.value;
        },
        get activeValue() {
            return handle.props.activeValue;
        },
        registerOption(option) {
            options.push(option);
        },
        async select(value) {
            if (state === State.Selecting) {
                return;
            }
            state = State.Selecting;
            let option = getOption(value);
            if (!isInteractableOption(option)) {
                state = State.Idle;
                return;
            }
            handle.props.onSelect(value, option);
            if (option && handle.props.flashSelection) {
                await flashAttribute(option.node, handle.props.selectionFlashAttribute ?? 'data-listbox-flash', 60);
            }
            await handle.props.onSelectSettled?.(value, option);
            state = State.Idle;
        },
        highlight(value) {
            if (state === State.Selecting)
                return;
            let option = getOption(value);
            handle.props.onHighlight(value, option);
        },
        highlightSearchMatch(text) {
            if (state === State.Selecting)
                return;
            let option = findSearchMatch(text, handle.props.activeValue);
            if (option) {
                handle.props.onHighlight(option.value, option);
                scrollOptionIntoView(option);
            }
        },
        navigate(strategy) {
            if (state === State.Selecting)
                return;
            let option;
            let interactableOptions = getInteractableOptions();
            let activeIndex = interactableOptions.findIndex((option) => option.value === handle.props.activeValue);
            switch (strategy) {
                case NavigationStrategy.Next:
                    option = interactableOptions[activeIndex + 1] ?? interactableOptions[0];
                    break;
                case NavigationStrategy.Previous:
                    option =
                        activeIndex === -1
                            ? interactableOptions[interactableOptions.length - 1]
                            : interactableOptions[activeIndex - 1];
                    break;
                case NavigationStrategy.First:
                    option = interactableOptions[0];
                    break;
                case NavigationStrategy.Last:
                    option = interactableOptions[interactableOptions.length - 1];
                    break;
            }
            if (option) {
                handle.props.onHighlight(option.value, option);
                scrollOptionIntoView(option);
            }
        },
        scrollActiveOptionIntoView() {
            scrollOptionIntoView(getOption(handle.props.activeValue));
        },
    };
    handle.context.set(context);
    return () => {
        options = [];
        return handle.props.children;
    };
}
const listMixin = createMixin((handle) => (props) => {
    let context = handle.context.get(ListboxProvider);
    return [
        attrs({
            tabIndex: props.tabIndex ?? -1,
            role: props.role ?? 'listbox',
        }),
        on('focus', () => {
            context.scrollActiveOptionIntoView();
        }),
        on('keydown', (event) => {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    context.navigate(NavigationStrategy.Next);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    context.navigate(NavigationStrategy.Previous);
                    break;
                case 'Tab':
                    event.preventDefault();
                    context.navigate(NavigationStrategy.First);
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    void context.select(context.activeValue);
                    break;
                case 'Home':
                    event.preventDefault();
                    context.navigate(NavigationStrategy.First);
                    break;
                case 'End':
                    event.preventDefault();
                    context.navigate(NavigationStrategy.Last);
            }
        }),
        hiddenTypeahead((text) => {
            context.highlightSearchMatch(text);
        }),
    ];
});
const optionMixin = createMixin((handle) => {
    let optionRef;
    handle.queueTask((node) => {
        optionRef = node;
    });
    return (option) => {
        let context = handle.context.get(ListboxProvider);
        context.registerOption({
            ...option,
            id: handle.id,
            get hidden() {
                return optionRef?.hidden === true;
            },
            get node() {
                return optionRef;
            },
        });
        return [
            attrs({
                role: 'option',
                id: handle.id,
                'aria-selected': context.value === option.value ? 'true' : 'false',
                'aria-disabled': option.disabled ? 'true' : 'false',
                'data-highlighted': context.activeValue === option.value ? 'true' : 'false',
            }),
            !option.disabled && [
                on('click', () => {
                    context.select(option.value);
                }),
                on('mousemove', () => {
                    if (context.activeValue === option.value)
                        return;
                    context.highlight(option.value);
                }),
                on('mouseleave', () => {
                    if (context.activeValue !== option.value)
                        return;
                    context.highlight(null);
                }),
            ],
        ];
    };
});
export const Context = ListboxProvider;
export const list = listMixin;
export const option = optionMixin;
//# sourceMappingURL=listbox.js.map