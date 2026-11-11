import {
  attrs,
  createMixin,
  css,
  on,
  type ElementProps,
  type Handle,
  type MixinFactory,
  type RemixNode,
} from '@remix-run/component'
import { hiddenTypeahead, matchNextItemBySearchText, type SearchValue } from './lib/typeahead.ts'
import { commitOnRelease } from './lib/popup-press.ts'

export type ListboxValue = string | null

type NavigationStrategy = 'next' | 'previous' | 'first' | 'last'

interface Values {
  value: ListboxValue
  activeValue: ListboxValue
}

export interface ListboxContext extends Values {
  registerOption: (option: RegisteredOption) => void
  select: (value: ListboxValue) => void
  highlight: (value: ListboxValue) => void
  highlightSearchMatch: (text: string) => void
  navigate: (direction: NavigationStrategy) => void
  scrollActiveOptionIntoView: () => void
}

export interface ListboxProviderProps extends Values {
  children?: RemixNode
  ref?: (ref: ListboxRef) => void
  onSelect: (value: ListboxValue, option?: ListboxRegisteredOption) => void
  onHighlight: (value: ListboxValue, option?: ListboxRegisteredOption) => void
}

export interface ListboxRef {
  active: ListboxRegisteredOption | undefined
  options: ReadonlyArray<ListboxRegisteredOption>
  selected: ListboxRegisteredOption | undefined
  highlight: (value: ListboxValue) => void
  highlightSearchMatch: (text: string) => void
  matchSearchText: (text: string, fromValue?: ListboxValue) => ListboxRegisteredOption | null
  navigateFirst: () => void
  navigateLast: () => void
  navigateNext: () => void
  navigatePrevious: () => void
  scrollActiveOptionIntoView: () => void
  select: (value: ListboxValue) => void
  selectActive: () => void
}

export interface ListboxRegisteredOption extends ListboxOption {
  readonly hidden: boolean
  readonly node: HTMLElement
}

interface RegisteredOption extends ListboxRegisteredOption {}

function ListboxProvider(handle: Handle<ListboxProviderProps, ListboxContext>): () => RemixNode {
  let options: RegisteredOption[] = []

  function getOption(value: ListboxValue) {
    return options.find((option) => option.value === value)
  }

  function isVisibleOption(option: RegisteredOption | undefined): option is RegisteredOption {
    return !!option?.node?.isConnected && !option.hidden
  }

  function isInteractableOption(option: RegisteredOption | undefined) {
    return isVisibleOption(option) && !option?.disabled
  }

  function getInteractableOptions() {
    return options.filter(isInteractableOption)
  }

  function scrollOptionIntoView(option: RegisteredOption | undefined) {
    if (!isVisibleOption(option)) {
      return
    }

    option.node.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }

  function findSearchMatch(text: string, fromValue = handle.props.activeValue) {
    let interactableOptions = getInteractableOptions()
    let fromIndex = interactableOptions.findIndex((option) => option.value === fromValue)

    return matchNextItemBySearchText(text, interactableOptions, {
      fromIndex,
      getSearchValues: (option) => option.textValue ?? option.label,
    })
  }

  let context: ListboxContext

  let ref: ListboxRef = {
    get active() {
      return getOption(handle.props.activeValue)
    },
    get options() {
      return options
    },
    get selected() {
      return getOption(handle.props.value)
    },
    highlight(value) {
      context.highlight(value)
    },
    highlightSearchMatch(text) {
      context.highlightSearchMatch(text)
    },
    matchSearchText(text, fromValue = handle.props.activeValue) {
      return findSearchMatch(text, fromValue)
    },
    navigateFirst() {
      context.navigate('first')
    },
    navigateLast() {
      context.navigate('last')
    },
    navigateNext() {
      context.navigate('next')
    },
    navigatePrevious() {
      context.navigate('previous')
    },
    scrollActiveOptionIntoView() {
      context.scrollActiveOptionIntoView()
    },
    select(value) {
      return context.select(value)
    },
    selectActive() {
      return context.select(handle.props.activeValue)
    },
  }

  handle.queueTask(() => {
    handle.props.ref?.(ref)
  })

  context = {
    get value() {
      return handle.props.value
    },

    get activeValue() {
      return handle.props.activeValue
    },

    registerOption(option) {
      options.push(option)
    },

    select(value) {
      let option = getOption(value)
      if (!isInteractableOption(option)) return
      handle.props.onSelect(value, option)
    },

    highlight(value) {
      let option = getOption(value)
      handle.props.onHighlight(value, option)
    },

    highlightSearchMatch(text) {
      let option = findSearchMatch(text, handle.props.activeValue)

      if (option) {
        handle.props.onHighlight(option.value, option)
        scrollOptionIntoView(option)
      }
    },

    navigate(strategy: NavigationStrategy) {
      let option: RegisteredOption | undefined
      let interactableOptions = getInteractableOptions()
      let activeIndex = interactableOptions.findIndex(
        (option) => option.value === handle.props.activeValue,
      )

      switch (strategy) {
        case 'next':
          option = interactableOptions[activeIndex + 1] ?? interactableOptions[0]
          break
        case 'previous':
          option =
            activeIndex === -1
              ? interactableOptions[interactableOptions.length - 1]
              : interactableOptions[activeIndex - 1]
          break
        case 'first':
          option = interactableOptions[0]
          break
        case 'last':
          option = interactableOptions[interactableOptions.length - 1]
          break
      }

      if (option) {
        handle.props.onHighlight(option.value, option)
        scrollOptionIntoView(option)
      }
    },

    scrollActiveOptionIntoView() {
      scrollOptionIntoView(getOption(handle.props.activeValue))
    },
  }

  handle.context.set(context)

  return () => {
    options = []
    return handle.props.children
  }
}

const listMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<HTMLElement>(
  (handle) => (props) => {
    let context = handle.context.get(ListboxProvider)
    return [
      attrs({
        tabIndex: props.tabIndex ?? -1,
        role: props.role ?? 'listbox',
      }),
      on('focus', () => {
        context.scrollActiveOptionIntoView()
      }),
      on('keydown', (event) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            context.navigate('next')
            break
          case 'ArrowUp':
            event.preventDefault()
            context.navigate('previous')
            break
          case 'Tab':
            event.preventDefault()
            context.navigate('first')
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            context.select(context.activeValue)
            break
          case 'Home':
            event.preventDefault()
            context.navigate('first')
            break
          case 'End':
            event.preventDefault()
            context.navigate('last')
        }
      }),
      hiddenTypeahead((text) => {
        context.highlightSearchMatch(text)
      }),
    ]
  },
)

export interface ListboxOption {
  id: string
  value: string
  label: string
  disabled?: boolean
  textValue?: SearchValue
}

const optionMixin: MixinFactory<HTMLElement, [option: Omit<ListboxOption, 'id'>], ElementProps> =
  createMixin<HTMLElement, [option: Omit<ListboxOption, 'id'>]>((handle) => {
    let optionRef: HTMLElement | undefined

    handle.queueTask((node) => {
      optionRef = node
    })

    return (option) => {
      let context = handle.context.get(ListboxProvider)
      context.registerOption({
        ...option,
        id: handle.id,
        get hidden() {
          return optionRef?.hidden === true
        },
        get node() {
          return optionRef as HTMLElement
        },
      })

      return [
        attrs({
          role: 'option',
          id: handle.id,
          'aria-selected': context.value === option.value ? 'true' : 'false',
          'aria-disabled': option.disabled ? 'true' : 'false',
          'data-highlighted': context.activeValue === option.value ? 'true' : 'false',
        }),
        // Items are chosen, not read: no text cursor and no text selection, including when disabled.
        css({ cursor: 'default', userSelect: 'none', webkitUserSelect: 'none' }),
        !option.disabled && [
          commitOnRelease(),
          on('click', () => {
            context.select(option.value)
          }),
          // Pointer events, not mouse events: a press that prevented default on `pointerdown` (the
          // select trigger) suppresses compatibility mouse events until release, which would stop
          // the highlight following a held drag. Touch is excluded so a scroll doesn't highlight.
          on('pointermove', (event) => {
            if (event.pointerType === 'touch' || context.activeValue === option.value) return
            context.highlight(option.value)
          }),
          on('pointerleave', (event) => {
            if (event.pointerType === 'touch') return
            if (context.activeValue !== option.value) return
            context.highlight(null)
          }),
        ],
      ]
    }
  })

export const Context = ListboxProvider
export const list = listMixin
export const option = optionMixin
