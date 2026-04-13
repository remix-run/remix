---
name: author-ui-modules
description: Build idiomatic `packages/ui` modules for Remix. Use when authoring or revising first-party UI primitives, controller-backed controls, popup or overlay modules, or role mixins that coordinate shared state through a context-provided controller and expose bubbling DOM events.
---

# Author UI Modules

Use this skill when building `packages/ui` APIs that are more than one component.

For a concrete model, follow `packages/ui/src/lib/popover/popover.ts`.

## Default Shape

In `packages/ui`, prefer a module with four parts:

1. A controller for shared state and cross-element actions
2. A context component that creates and provides one controller instance
3. Role mixins that attach behavior to specific host elements
4. Bubbling DOM events for public state changes

The caller keeps control of markup. The module coordinates behavior.

## Terminology

Call these **modules**, not just components.

A module may include:

- a controller class
- a context component
- several role mixins
- custom event types
- small helpers

The exported namespace is the product.

## Reach For The Smallest Abstraction

- Use a plain mixin when the concern belongs to one host element.
- Use a module when behavior spans multiple roles or elements but should stay headless.
- Use a wrapper component only when the module must own structure, layout, or a very high-level authored API.

Prefer `popover.button` plus `popover.surface` over a single `<Popover />` wrapper when consumers should choose the elements.

## Controller Rules

The controller is the single source of truth for shared module state.

Put these in the controller:

- open or closed state
- selected value or active item
- current opener, anchor, surface, or registration state
- shared focus behavior
- cross-element cleanup like anchoring or observers
- imperative actions such as `show()`, `hide()`, `select()`, or `focusNext()`

Do not put these in the controller:

- raw DOM event parsing that only one role cares about
- validation that belongs to a specific role mixin
- transient callback-local values
- per-element state that is not shared

Controllers should expose a small API. Mixins normalize input before calling it.

Use an internal `change` event so dependent mixins can re-render:

```tsx
type MyControllerEventMap = {
  change: Event
}

class MyController extends TypedEventTarget<MyControllerEventMap> {
  #open = false

  get isOpen() {
    return this.#open
  }

  show() {
    if (this.#open) return
    this.#open = true
    this.dispatchEvent(new Event('change'))
  }
}
```

If outside consumers need to react, dispatch a bubbling DOM event from the relevant element when public state changes.

## Context Rules

The context component exists to scope one controller instance to one module instance.

- Create the controller once in setup scope.
- Call `handle.context.set(controller)` in render.
- Return `props.children` unless the module truly needs wrapper DOM.
- Add a `get...Controller()` helper that throws with a clear error when a role is used outside its context.

```tsx
function MyContext(handle: Handle<MyController>) {
  let controller = new MyController(handle.id)

  return (props: { children?: RemixNode }) => {
    handle.context.set(controller)
    return props.children ?? null
  }
}

function getMyController(handle: Handle | MixinHandle) {
  let controller = handle.context.get(MyContext)
  if (!(controller instanceof MyController)) {
    throw new Error('My module roles must be used inside myModule.context')
  }
  return controller
}
```

## Role Mixins

Role mixins are adapters between DOM elements and the controller.

Each mixin should:

- own one role
- derive attrs and ARIA from controller state
- validate and normalize user input for that role
- call controller methods with normalized values
- manage its own non-shared state in mixin setup scope
- subscribe to controller `change` when its rendered output depends on shared state

Examples of role-local state:

- current anchor options for a trigger
- a registration object for one host node
- local cleanup functions
- refs used only by that role

Examples of shared state that should not be duplicated in each mixin:

- whether the module is open
- which item is active or selected
- the module's shared ids
- where focus returns on close

Update from controller changes with the standard pattern:

```tsx
let myRole = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getMyController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => [
    attrs({ 'aria-expanded': controller.isOpen }),
    on('click', () => {
      controller.show()
    }),
  ]
})
```

## Input Normalization

Mixins should turn messy DOM input into small controller calls.

Good:

- pointer vs keyboard handling in the trigger mixin
- host defaults like `type="button"` for button hosts
- outside-press, escape, and focusout handlers mapped to `controller.hide()`
- id and default attr wiring derived from `controller.id`

Avoid pushing raw event branching into the controller unless it affects shared behavior across multiple roles.

## State Placement

Choose the narrowest lifetime that fits:

- shared across roles: controller
- persistent for one host element: mixin setup scope
- only needed for one callback: callback scope
- only needed after the next render: the same event handler after `await handle.update()` or a deliberate queued task

Do not create setup-scope state just to react to it on the next render.

## DOM Work

Put imperative DOM work where the ownership is clear.

Use the controller for DOM work that is shared or cross-element:

- focus restoration
- focus on open
- anchor synchronization
- module-wide cleanup tied to shared state

Use mixins for DOM work that belongs to one host element:

- registration via `ref(...)`
- local listeners
- host-specific validation
- element-local measurement or observers

Prefer doing post-update DOM work in the same handler that caused the update.

## Internal Vs External Communication

Use context plus controller methods for internal coordination.

Use real bubbling DOM events for external communication.

A good module usually exposes both:

- internal `controller.addEventListener('change', ...)`
- external `myModule.change` plus `MyModuleChangeEvent`

This keeps internals ergonomic without making consumers reach into context.

## Public API Shape

Prefer a namespace object that exports the module's roles and event names.

```tsx
type MyModuleApi = {
  readonly context: typeof MyContext
  readonly trigger: typeof myTriggerMixin
  readonly surface: typeof mySurfaceMixin
  readonly dismiss: typeof myDismissMixin
  readonly change: typeof myChangeEventType
}

export let myModule: MyModuleApi = {
  context: MyContext,
  trigger: myTriggerMixin,
  surface: mySurfaceMixin,
  dismiss: myDismissMixin,
  change: myChangeEventType,
}
```

This is usually a better fit than exporting one wrapper component plus many props.

## Keep Modules Headless

Prefer APIs that let callers choose:

- which element is the trigger
- which element is the surface
- where content lives
- what styling mixins they compose in

Avoid wrapper-heavy `as` or `asChild` style APIs when role mixins already express the behavior cleanly.

## Checklist

When authoring a `packages/ui` module, verify:

- the public API is module-shaped, not wrapper-shaped, unless wrapper DOM is truly required
- shared state lives in one controller
- the context component only scopes and provides the controller
- each mixin owns one role and one host element
- mixins normalize DOM input before calling the controller
- mixins keep their own non-shared state locally
- cross-element DOM behavior lives in the controller
- outside consumers learn about state changes through bubbling DOM events
- internal coordination happens through context and the controller, not prop threading
- the caller still owns the markup

## Anti-Patterns

Avoid:

- one large wrapper component with many role props
- duplicating shared state across trigger, surface, and dismiss roles
- controller methods that require raw DOM events from every mixin
- using context as the public external API
- prop drilling between roles that already share a controller
- wrapper components created only to attach one mixin
