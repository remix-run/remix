import { attrs, createMixin, on, } from '@remix-run/ui';
import { hiddenTypeahead, matchNextItemBySearchText, } from "../../interactions/typeahead/typeahead-mixin.js";
import { flashAttribute } from "../../utils/flash-attribute.js";
function ListboxProvider(handle) {
    let options = [];
    let state = 'idle';
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
            context.navigate('first');
        },
        navigateLast() {
            context.navigate('last');
        },
        navigateNext() {
            context.navigate('next');
        },
        navigatePrevious() {
            context.navigate('previous');
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
            if (state === 'selecting') {
                return;
            }
            state = 'selecting';
            let option = getOption(value);
            if (!isInteractableOption(option)) {
                state = 'idle';
                return;
            }
            handle.props.onSelect(value, option);
            if (option && handle.props.flashSelection) {
                await flashAttribute(option.node, handle.props.selectionFlashAttribute ?? 'data-listbox-flash', 60);
            }
            await handle.props.onSelectSettled?.(value, option);
            state = 'idle';
        },
        highlight(value) {
            if (state === 'selecting')
                return;
            let option = getOption(value);
            handle.props.onHighlight(value, option);
        },
        highlightSearchMatch(text) {
            if (state === 'selecting')
                return;
            let option = findSearchMatch(text, handle.props.activeValue);
            if (option) {
                handle.props.onHighlight(option.value, option);
                scrollOptionIntoView(option);
            }
        },
        navigate(strategy) {
            if (state === 'selecting')
                return;
            let option;
            let interactableOptions = getInteractableOptions();
            let activeIndex = interactableOptions.findIndex((option) => option.value === handle.props.activeValue);
            switch (strategy) {
                case 'next':
                    option = interactableOptions[activeIndex + 1] ?? interactableOptions[0];
                    break;
                case 'previous':
                    option =
                        activeIndex === -1
                            ? interactableOptions[interactableOptions.length - 1]
                            : interactableOptions[activeIndex - 1];
                    break;
                case 'first':
                    option = interactableOptions[0];
                    break;
                case 'last':
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
                    context.navigate('next');
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    context.navigate('previous');
                    break;
                case 'Tab':
                    event.preventDefault();
                    context.navigate('first');
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    void context.select(context.activeValue);
                    break;
                case 'Home':
                    event.preventDefault();
                    context.navigate('first');
                    break;
                case 'End':
                    event.preventDefault();
                    context.navigate('last');
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