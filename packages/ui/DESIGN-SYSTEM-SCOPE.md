# Design System Scope

This document defines the scope needed for `remix/ui` to become a strong design system and component library for typical productivity web apps.

It should be read together with [API-DESIGN-PRINCIPLES.md](/Users/ryan/remix-run/remix/packages/ui/API-DESIGN-PRINCIPLES.md). That document is the filter for what belongs here.

This is not a goal of rebuilding Tailwind or matching every shadcn API. The intended shape is closer to an OS-style UI kit for application work:

- calm
- dense
- utilitarian
- consistent
- behavior-aware

## Product Goal

`remix/ui` should give app teams the shared building blocks they need for a serious productivity interface without forcing them to reach for another styling system or component kit.

That means:

- a small, stable token set
- semantic mixins for the patterns apps actually repeat
- thin first-party components for behavior-heavy UI
- a few structural blocks for common app layouts

`css()` already handles one-off styling well. This package should only cover the things that deserve system-level consistency.

## API Layers

## 1. Theme Tokens

These are the CSS-variable-backed values exposed as `theme.*`.

The token layer should stay intentionally small.

### Core token groups

- `space`
- `radius`
- `fontFamily`
- `fontSize`
- `lineHeight`
- `letterSpacing`
- `fontWeight`
- `shadow`
- `duration`
- `easing`
- `zIndex`
- `colors.text.*`
- `surface.*`
- `colors.border.*`
- `colors.focus.*`
- `colors.overlay.*`
- `colors.action.*`
- `colors.status.*`
- `control.height.*`

### Possible additions

Only add these if they become clearly shared and stable:

- `icon.size.*`
- `sidebar.width`
- `header.height`
- `dialog.width`
- `tooltip.maxWidth`
- `chart` color roles

### Things we should resist tokenizing early

- arbitrary widths and heights
- transforms
- blur and effect values that are not truly thematic
- one-off layout measurements
- aliases that do not add meaning beyond plain CSS

## 2. Mixins

These are the reusable `ui.*` APIs.

This is the highest-value styling layer in the system. Mixins should focus on repeated application patterns, not broad CSS coverage for its own sake.

### Primitive mixins worth keeping small

These exist because they are constantly useful in app code:

- spacing: `p|px|py|pt|pr|pb|pl`
- margin: `m|mx|my|mt|mr|mb|ml`
- `gap`
- `rounded`
- `textSize`
- `fontWeight`
- `textColor`
- `bg`
- `borderColor`
- `shadow`
- `row`
- `stack`
- `icon.*`
- `animation.spin`

We should only add more primitive mixins when they show up repeatedly in real app work.

### Core semantic mixin families

These are the styling building blocks for the first-party component library and for app composition:

- `ui.text.*`
- `ui.card.*`
- `ui.button.*`
- `ui.field.*`
- `ui.fieldText.*`
- `ui.item.*`
- `ui.nav.*`
- `ui.sidebar.*`
- `ui.status.*`
- `ui.popover`
- `ui.menu.*`
- `ui.listbox.*`

### Next semantic mixin families

These are likely the next high-value additions for productivity UI:

- `ui.input.*`
- `ui.textarea.*`
- `ui.select.*`
- `ui.checkbox.*`
- `ui.radio.*`
- `ui.switch.*`
- `ui.tabs.*`
- `ui.table.*`
- `ui.dialog.*`
- `ui.tooltip.*`
- `ui.badge.*`
- `ui.spinner.*`
- `ui.skeleton.*`
- `ui.separator.*`
- `ui.breadcrumb.*`
- `ui.pagination.*`
- `ui.combobox.*`
- `ui.command.*`

### Slot mixins

This is one of our main advantages over wrapper-heavy component libraries.

We should keep pushing slot-level styling where it improves composition:

- `ui.button.icon`
- `ui.button.label`
- `ui.card.header`
- `ui.card.body`
- `ui.card.footer`
- `ui.fieldText.label`
- `ui.fieldText.help`
- `ui.dialog.header`
- `ui.dialog.body`
- `ui.dialog.footer`
- `ui.tabs.list`
- `ui.tabs.trigger`
- `ui.tabs.panel`
- `ui.table.row`
- `ui.table.cell`

### Variant support

The most valuable force multiplier on mixins is state support, not raw utility count.

Important variants:

- hover
- focus
- focusVisible
- active
- disabled
- selected
- open
- checked
- invalid
- responsive breakpoints where necessary
- prefers-reduced-motion

## 3. Components

Components should stay thin wherever possible. If a problem is mainly styling, it should usually be a mixin. If the problem is behavior, accessibility, semantics, or state coordination, it likely deserves a component.

### Core components for a productivity app

- `Button`
- `Card`
- `Field`
- `Input`
- `Textarea`
- `Checkbox`
- `RadioGroup`
- `Switch`
- `Select`
- `Combobox`
- `Dialog`
- `Popover`
- `DropdownMenu`
- `Tooltip`
- `Tabs`
- `Table`
- `Toast`
- `Spinner`
- `Skeleton`
- `Badge`
- `Empty`

### Good next components

- `Command`
- `Calendar`
- `DatePicker`
- `Progress`
- `Accordion`
- `Collapsible`
- `NavigationMenu`
- `Pagination`
- `Breadcrumb`
- `Avatar`

### Components we should not rush

These may be useful later, but they are not part of the smallest compelling scope for a productivity-first kit:

- `Carousel`
- `Chart`
- `AspectRatio`
- `Resizable`
- `InputOTP`
- `HoverCard`
- `Menubar`
- `ContextMenu`
- `Drawer`
- `Sheet`

## 4. Blocks

Blocks are where the system starts to feel like an application UI kit instead of only a component library.

### Highest-value blocks

- `SidebarLayout`
- `PageHeader`
- `SectionHeader`
- `FilterBar`
- `SearchToolbar`
- `FormSection`
- `EmptyState`
- `ListDetailLayout`
- `SettingsLayout`
- `TableToolbar`

### Useful later blocks

- `StatCard`
- `ActivityFeed`
- `DialogForm`
- `ActionBar`
- `BreadcrumbBar`
- `PaginationBar`
- `StatusCallout`

## Minimum Compelling Scope

If the goal is a strong first release for productivity apps, this is the minimum useful scope.

### Tier 1: small stable foundations

- conservative tokens
- spacing, color, radius, typography, shadow, and motion primitives
- row and stack layout mixins
- focus ring and calm motion support
- a predictable reset strategy

### Tier 2: semantic styling system

- text
- surface
- card
- button
- field
- item
- nav
- sidebar
- status

### Tier 3: behavior-heavy core components

- Button
- Card
- Field
- Input
- Textarea
- Checkbox
- RadioGroup
- Switch
- Select
- Combobox
- Dialog
- Popover
- DropdownMenu
- Tooltip
- Tabs
- Table
- Toast
- Spinner
- Skeleton
- Badge
- Empty

### Tier 4: app-shaped blocks

- SidebarLayout
- PageHeader
- SectionHeader
- FilterBar
- SearchToolbar
- FormSection
- EmptyState
- ListDetailLayout
- SettingsLayout
- TableToolbar

## Gaps Between Current `remix/ui` And This Scope

### Tokens

We already have a good start. The main work is restraint, not expansion.

The likely additions are:

- `control.height.xl`
- maybe `icon.size.*`
- a few more semantic sizing tokens only if they prove stable

### Mixins

This is still the largest gap.

The next important areas are:

- inputs and textareas
- selects and choice controls
- tabs
- tables
- dialogs and popovers
- menus and tooltips
- badges, separators, spinners, and skeletons

### Components

This is the largest behavior gap.

The highest-value components to prioritize are:

- Input
- Select
- Dialog
- DropdownMenu
- Tabs
- Combobox
- Table
- Toast

### Blocks

This is the best differentiation opportunity.

The first blocks should help teams build:

- settings screens
- list/detail views
- searchable/filterable tables
- sidebar-driven app shells

## Recommended Build Order

1. Keep the token layer small and stable.
2. Expand semantic mixin families for the UI patterns that keep repeating in productivity apps.
3. Build thin first-party components on top of those mixins.
4. Add high-value product blocks once the lower layers are reliable.
