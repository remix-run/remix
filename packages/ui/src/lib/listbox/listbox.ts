import { attrs, createMixin, on, type Handle, type RemixNode } from '@remix-run/component'
import { hiddenTypeahead, matchNextItemBySearchText } from '../typeahead/typeahead-mixin.tsx'
import { flashAttribute } from '../utils/flash-attribute.ts'

export type ListboxValue = string | null

enum NavigationStrategy {
  Next = 0,
  Previous = 1,
  First = 2,
  Last = 3,
}

enum State {
  Idle = 'idle',
  Selecting = 'selecting',
}

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
  flashSelection?: boolean
  onSelect: (value: ListboxValue, option?: ListboxOption) => void
  onHighlight: (value: ListboxValue, option?: ListboxOption) => void
}

export interface ListboxRef {
  active: ListboxOption | undefined
  selected: ListboxOption | undefined
  matchSearchText: (text: string, fromValue?: ListboxValue) => ListboxOption | null
}

const UNSET_PROPS = {
  value: null,
  activeValue: null,
  flash: true,
  onSelect: () => {},
  onHighlight: () => {},
}

interface RegisteredOption extends ListboxOption {
  node: HTMLElement
}

export function ListboxProvider(handle: Handle<ListboxContext>) {
  let options: RegisteredOption[] = []
  let props: ListboxProviderProps = UNSET_PROPS
  let state = State.Idle

  function getOption(value: ListboxValue) {
    return options.find((option) => option.value === value)
  }

  function scrollOptionIntoView(option: RegisteredOption | undefined) {
    if (!option?.node?.isConnected) {
      return
    }

    option.node.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }

  function findSearchMatch(text: string, fromValue = props.activeValue) {
    let enabledOptions = options.filter(enabledOption)
    let fromIndex = enabledOptions.findIndex((option) => option.value === fromValue)

    return matchNextItemBySearchText(text, enabledOptions, {
      fromIndex,
      getSearchValues: (option) => option.textValue ?? option.label,
    })
  }

  let ref: ListboxRef = {
    get active() {
      return getOption(props.activeValue)
    },
    get selected() {
      return getOption(props.value)
    },
    matchSearchText(text, fromValue = props.activeValue) {
      return findSearchMatch(text, fromValue)
    },
  }

  handle.queueTask(() => {
    props.ref?.(ref)
  })

  handle.context.set({
    get value() {
      return props.value
    },

    get activeValue() {
      return props.activeValue
    },

    registerOption(option) {
      options.push(option)
    },

    async select(value) {
      if (state === State.Selecting) {
        return
      }
      state = State.Selecting
      let option = options.find((option) => option.value === value)
      if (option && props.flashSelection) {
        await flashAttribute(option.node, 'data-flash', 60)
      }
      props.onSelect(value, option)
      handle.queueTask(() => {
        state = State.Idle
      })
    },

    highlight(value) {
      if (state === State.Selecting) return
      let option = getOption(value)
      props.onHighlight(value, option)
    },

    highlightSearchMatch(text) {
      if (state === State.Selecting) return

      let option = findSearchMatch(text, props.activeValue)

      if (option) {
        props.onHighlight(option.value, option)
        scrollOptionIntoView(option)
      }
    },

    navigate(strategy: NavigationStrategy) {
      if (state === State.Selecting) return

      let option: RegisteredOption | undefined
      let activeIndex = options.findIndex((option) => option.value === props.activeValue)

      switch (strategy) {
        case NavigationStrategy.Next:
          option = options.slice(activeIndex + 1).find(enabledOption)
          break
        case NavigationStrategy.Previous:
          let endIndex = activeIndex === -1 ? options.length : activeIndex
          option = options.slice(0, endIndex).findLast(enabledOption)
          break
        case NavigationStrategy.First:
          option = options.find(enabledOption)
          break
        case NavigationStrategy.Last:
          option = options.findLast(enabledOption)
          break
      }

      if (option) {
        props.onHighlight(option.value, option)
        scrollOptionIntoView(option)
      }
    },

    scrollActiveOptionIntoView() {
      scrollOptionIntoView(getOption(props.activeValue))
    },
  })

  return (nextProps: ListboxProviderProps) => {
    options = []
    props = nextProps
    return props.children
  }
}

let listMixin = createMixin<HTMLElement>((handle) => {
  return (props) => {
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
            context.navigate(NavigationStrategy.Next)
            break
          case 'ArrowUp':
            event.preventDefault()
            context.navigate(NavigationStrategy.Previous)
            break
          case 'Tab':
            event.preventDefault()
            context.navigate(NavigationStrategy.First)
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            void context.select(context.activeValue)
            break
          case 'Home':
            event.preventDefault()
            context.navigate(NavigationStrategy.First)
            break
          case 'End':
            event.preventDefault()
            context.navigate(NavigationStrategy.Last)
        }
      }),
      hiddenTypeahead((text) => {
        context.highlightSearchMatch(text)
      }),
    ]
  }
})

export interface ListboxOption {
  id: string
  value: string
  label: string
  disabled?: boolean
  textValue?: string
}

let optionMixin = createMixin<HTMLElement, [option: Omit<ListboxOption, 'id'>]>((handle) => {
  let optionRef: HTMLElement

  handle.queueTask((node) => {
    optionRef = node
  })

  return (option) => {
    let context = handle.context.get(ListboxProvider)
    context.registerOption({
      ...option,
      id: handle.id,
      get node() {
        return optionRef
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
      !option.disabled && [
        on('click', () => {
          context.select(option.value)
        }),
        on('mousemove', () => {
          if (context.activeValue === option.value) return
          context.highlight(option.value)
        }),
        on('mouseleave', () => {
          if (context.activeValue !== option.value) return
          context.highlight(null)
        }),
      ],
    ]
  }
})

function enabledOption(option: RegisteredOption) {
  return !option.disabled
}

type ListboxApi = {
  readonly context: typeof ListboxProvider
  readonly list: typeof listMixin
  readonly option: typeof optionMixin
}

export let listbox: ListboxApi = {
  context: ListboxProvider,
  list: listMixin,
  option: optionMixin,
}
