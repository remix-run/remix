# API Design Principles

This document defines how we decide what belongs in `remix/ui`.

The short version:

- `css()` is already powerful
- we do not need to recreate all of CSS as design-system API
- every token, mixin, component, and block should earn its existence

## Core Principle

`remix/ui` is not trying to replace CSS.

Tailwind needs a huge API surface because ordinary inline styling is weak and component-library styling is awkward. We do not have those constraints. Our `css()` mixin is already expressive, composable, and local.

That means we should only add design-system API when it creates one or more of these:

- shared meaning
- shared consistency
- shared ergonomics
- shared behavior

If raw `css()` is already clear, local, and not repetitive, we should usually prefer it.

## Layer Rules

### Theme tokens

Add a token when the value is part of the visual language of the system.

Good token categories:

- spacing scale
- radius scale
- typography scale
- semantic color roles
- control heights
- shadow scale
- motion timing

Bad token candidates:

- arbitrary widths
- one-off transforms
- component-local values
- aliases that do not add meaning

A token should pass this test:

- should multiple components agree on this value?
- would changing it be a theme decision?

If not, it probably belongs in local `css()`.

### Mixins

Add a mixin when app code or first-party components would otherwise repeat the same cluster of styles or host reset logic.

Good mixins:

- semantic roles like `ui.text.*`, `ui.card.*`, `ui.item.*`, `ui.status.*`
- recurring layout patterns like `ui.row` and `ui.stack`
- slot styles like `ui.button.icon` and `ui.card.header`
- host resets that reconstruct a consistent base like `ui.button.base`

Bad mixins:

- wrappers around a single CSS property with little shared meaning
- APIs that save only a few characters
- abstractions that make styling harder to reason about

A mixin should usually be one of:

- a semantic role
- a recurring layout pattern
- a slot style
- a host reset plus reconstruction

### Components

Add a component when semantics, accessibility, state, or behavior are non-trivial.

Good component candidates:

- Dialog
- Tabs
- Combobox
- Select
- Tooltip
- DropdownMenu
- Checkbox
- RadioGroup
- Switch
- Toast

We should be much more conservative about components that are mostly presentational. If `mix` plus normal HTML already gives a clean result, a component may not be necessary.

Components should earn their existence through:

- behavior
- semantics
- accessibility
- state coordination
- ergonomics that plain markup cannot provide cleanly

### Blocks

Add a block when the composition repeats at product level.

Good blocks:

- SidebarLayout
- PageHeader
- EmptyState
- FilterBar
- ListDetailLayout

Blocks are where we should solve larger structural problems:

- hierarchy
- spacing
- surface composition
- common screen patterns

## Decision Tests

Before adding anything, ask:

1. Is this a theme decision?
2. Will multiple components or apps need to agree on it?
3. Is raw `css()` too repetitive or too easy to get subtly wrong here?
4. Does naming this improve communication?
5. Would the system become clearer or noisier if this API existed?

If the answers are mostly no, do not add it.

## Healthy Bias By Layer

- `theme.*`: conservative
- `ui.*`: moderate
- `<Component />`: conservative, but strong when behavior is hard
- blocks: selective and product-shaped

## Preferred Shape For `remix/ui`

We should generally prefer:

- fewer, stronger tokens
- more semantic mixins instead of exhaustive utility coverage
- thin, behavior-heavy components
- blocks that accelerate real application work

We should avoid:

- rebuilding all of Tailwind just because Tailwind exists
- tokenizing values that are not truly thematic
- mixins that are just renamed CSS
- wrapper-heavy component APIs when slot mixins and normal HTML already work

## Heuristic

- token: many things should share this value
- mixin: many things should share this styling pattern
- component: many things should share this behavior and semantics
- block: many screens should share this composition
