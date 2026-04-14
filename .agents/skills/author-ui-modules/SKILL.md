---
name: author-ui-modules
description: Build idiomatic `packages/ui` modules for Remix. Use when authoring or revising first-party UI primitives, headless controls, or mixin-based modules that should follow the `popover`, `listbox`, and `select` patterns in `packages/ui`.
---

# Author UI Modules

Use this skill when building `packages/ui` APIs that span multiple roles or compose smaller modules into one control.

## Preferred Shapes

Prefer one of these shapes:

1. A small headless module with:

- one provider/context component
- a plain context value with shared methods, refs, or getters
- a few focused role mixins
- a namespace export like `popover` or `listbox`

2. A composed control with:

- a wrapper component that owns rendered state
- composition of smaller modules like `popover` and `listbox`
- thin components that implement a mixin that improves authoring ergonomics

The caller should still own most markup unless the higher-level control is the actual product.

## Prefer Plain Context Over Controllers

Default to `handle.context.set(...)` with a plain object. Do not introduce a controller class or an event-emitter-on-context pattern unless the task truly needs it.

Two good context shapes:

- a stable mutable object for shared refs or targets, like `popover`
- a stable object with getters and methods over the latest props or state, like `listbox`

Internal coordination should flow through normal component updates plus context methods. Do not add a `TypedEventTarget` or `change` emitter to context just to wake up mixins.

```tsx
export function ListboxProvider(handle: Handle<ListboxContext>) {
  let options: RegisteredOption[] = []
  let props: ListboxProviderProps = UNSET_PROPS

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
    select(value) {
      let option = options.find((option) => option.value === value)
      props.onSelect(value, option)
    },
  })

  return (nextProps: ListboxProviderProps) => {
    options = []
    props = nextProps
    return props.children
  }
}
```

## Split State By Ownership

Do not force all state into one central abstraction.

Prefer:

- wrapper component state for render phases and displayed values, like `Select`
- provider state for shared coordination and registrations, like `popover` focus targets or `listbox` options
- mixin-local state for one host node, like refs, cleanup functions, or cached options
- callback scope for transient DOM event parsing
- for text-entry controls, provider state can own `inputText`, filter text, and open reasons while `listbox` still owns option registration, navigation, and selection settlement

If a lower-level module can stay mostly stateless, let the wrapper own the rendered state and pass that into the provider through props.

## Provider Patterns

Providers usually exist to scope one module instance and expose shared coordination helpers.

- Call `handle.context.set(...)` in setup scope when the context object can stay stable.
- Use getters on the context object when descendants need the latest prop-backed state.
- Return `props.children` unless wrapper DOM is genuinely part of the module.
- Reset render-scoped registries in the render function when descendants re-register on each render.
- Use `handle.queueTask()` when the provider needs to expose an imperative ref after render.
- If the module exposes an imperative handle, keep that handle stable and back it with getters and methods over the latest provider state.

The provider does not need to be the sole source of truth. In `listbox`, the wrapper owns `value` and `activeValue`, while the provider owns option registration and helper methods around that state.

## Role Mixins

Role mixins are the adapters between one host element and shared module behavior.

Each mixin should:

- own one role and one host element
- derive attrs and ARIA from context getters
- normalize DOM input before calling context methods
- keep node-local refs or cleanup local to the mixin
- register itself with the provider when the provider needs that node later
- keep role-specific keyboard parsing local, then translate it into context methods like `openFromArrow()`, `navigateNext()`, or `selectActive()`

Capture host nodes with `handle.queueTask((node) => { ... })`, `ref(...)`, or an insert listener when the mixin needs the real element.

```tsx
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
      }),
      on('click', () => {
        context.select(option.value)
      }),
    ]
  }
})
```

## Wrapper Components

Wrapper components are fine when the control itself is the product.

Use a wrapper component when it adds real value:

- it owns a small phase machine like `initializing`, `open`, or `selecting`
- it coordinates labels, displayed values, or authored structure
- it composes existing modules instead of re-implementing them

Thin child components are fine when they mostly apply lower-level mixins plus styling.

```tsx
<popover.context>
  <button mix={[popover.anchor({ placement: 'left' })]} />
  <div mix={[popover.surface({ open, onHide })]}>
    <listbox.context value={value} activeValue={activeValue} onSelect={selectOption}>
      <div mix={[popover.focusOnShow(), listbox.list()]}>{props.children}</div>
    </listbox.context>
  </div>
</popover.context>
```

## DOM Work

Keep imperative DOM work with the code that owns the relevant ref.

- use `handle.queueTask()` for post-render `showPopover()`, `hidePopover()`, anchoring, scrolling, or exposing refs
- use mixin-local refs for host-specific work
- use wrapper-component refs for composed controls like `Select`
- if one event needs DOM work after a state change, prefer the same handler after `await handle.update()`

Do not create extra setup-scope state just to react to it on the next render.

## External APIs

Use plain context methods and provider props for internal coordination.

Use bubbling DOM events only when the host element truly needs a DOM-level public contract. Do not use DOM events, controller classes, or context emitters as the default internal signaling layer.

## Public API Shape

Lower-level modules should usually export a namespace object of providers and mixins:

```tsx
export let popover = {
  context: PopoverProvider,
  focusOnHide: focusOnHideMixin,
  focusOnShow: focusOnShowMixin,
  surface: surfaceMixin,
  anchor: anchorMixin,
}
```

Higher-level controls can export named components like `Select` and `Option` that compose those lower-level modules.

## Checklist

When authoring a `packages/ui` module, verify:

- it matches the `popover`, `listbox`, or `select` patterns and composes existing lower-level modules instead of inventing a separate control shape
- shared coordination lives in plain context, not a controller class
- there is no event-emitter-on-context layer just to force descendant updates
- each mixin owns one role and one host element
- wrapper components only own markup when that markup is the product
- lower-level modules are composed instead of copied into higher-level controls
- DOM effects live with the code that owns the relevant refs

## Anti-Patterns

Avoid:

- introducing a controller class as the default abstraction
- adding `TypedEventTarget` or `change` emitters to context just to trigger updates
- duplicating open, selected, or active state across wrapper, provider, and mixins
- re-implementing `popover` or `listbox` behavior inside a higher-level control that could compose them
- copying specialized control logic into unrelated controls instead of composing lower-level modules
