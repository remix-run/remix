// @jsxRuntime classic
// @jsx createElement
import { clientEntry, createElement, type Handle } from 'remix/component'

import AccordionCardExample from '../examples/components/accordion-card.tsx'
import AccordionMultipleExample from '../examples/components/accordion-multiple.tsx'
import AccordionOverviewExample from '../examples/components/accordion-overview.tsx'
import AnchorExample from '../examples/components/anchor.tsx'
import ComboboxRemoteExample from '../examples/components/combobox-remote.tsx'
import ComboboxOverviewExample from '../examples/components/combobox-overview.tsx'
import ListboxPopoverExample from '../examples/components/listbox-popover.tsx'
import ListboxControlledExample from '../examples/components/listbox-controlled.tsx'
import ListboxOverviewExample from '../examples/components/listbox-overview.tsx'
import ListboxStaticExample from '../examples/components/listbox-static.tsx'
import ListboxStaticMultipleExample from '../examples/components/listbox-static-multiple.tsx'
import SelectDeconstructedExample from '../examples/components/select-deconstructed.tsx'
import SelectOverviewExample from '../examples/components/select-overview.tsx'
import MenuButtonBubblingExample from '../examples/components/menu-button-bubbling.tsx'
import MenuButtonOverviewExample from '../examples/components/menu-button-overview.tsx'
import PopoverOverviewExample from '../examples/components/popover-overview.tsx'

export let HydratedAccordionOverviewExample = clientEntry(
  '/assets/example-entries.js#HydratedAccordionOverviewExample',
  function HydratedAccordionOverviewExample(_handle: Handle) {
    return () => <AccordionOverviewExample />
  },
)

export let HydratedAccordionCardExample = clientEntry(
  '/assets/example-entries.js#HydratedAccordionCardExample',
  function HydratedAccordionCardExample(_handle: Handle) {
    return () => <AccordionCardExample />
  },
)

export let HydratedAccordionMultipleExample = clientEntry(
  '/assets/example-entries.js#HydratedAccordionMultipleExample',
  function HydratedAccordionMultipleExample(_handle: Handle) {
    return () => <AccordionMultipleExample />
  },
)

export let HydratedAnchorExample = clientEntry(
  '/assets/example-entries.js#HydratedAnchorExample',
  function HydratedAnchorExample(_handle: Handle) {
    return () => <AnchorExample />
  },
)

export let HydratedComboboxOverviewExample = clientEntry(
  '/assets/example-entries.js#HydratedComboboxOverviewExample',
  function HydratedComboboxOverviewExample(_handle: Handle) {
    return () => <ComboboxOverviewExample />
  },
)

export let HydratedComboboxRemoteExample = clientEntry(
  '/assets/example-entries.js#HydratedComboboxRemoteExample',
  function HydratedComboboxRemoteExample(_handle: Handle) {
    return () => <ComboboxRemoteExample />
  },
)

export let HydratedPopoverOverviewExample = clientEntry(
  '/assets/example-entries.js#HydratedPopoverOverviewExample',
  function HydratedPopoverOverviewExample(_handle: Handle) {
    return () => <PopoverOverviewExample />
  },
)

export let HydratedListboxOverviewExample = clientEntry(
  '/assets/example-entries.js#HydratedListboxOverviewExample',
  function HydratedListboxOverviewExample(_handle: Handle) {
    return () => <ListboxOverviewExample />
  },
)

export let HydratedListboxPopoverExample = clientEntry(
  '/assets/example-entries.js#HydratedListboxPopoverExample',
  function HydratedListboxPopoverExample(_handle: Handle) {
    return () => <ListboxPopoverExample />
  },
)

export let HydratedListboxControlledExample = clientEntry(
  '/assets/example-entries.js#HydratedListboxControlledExample',
  function HydratedListboxControlledExample(_handle: Handle) {
    return () => <ListboxControlledExample />
  },
)

export let HydratedListboxStaticExample = clientEntry(
  '/assets/example-entries.js#HydratedListboxStaticExample',
  function HydratedListboxStaticExample(_handle: Handle) {
    return () => <ListboxStaticExample />
  },
)

export let HydratedListboxStaticMultipleExample = clientEntry(
  '/assets/example-entries.js#HydratedListboxStaticMultipleExample',
  function HydratedListboxStaticMultipleExample(_handle: Handle) {
    return () => <ListboxStaticMultipleExample />
  },
)

export let HydratedSelectOverviewExample = clientEntry(
  '/assets/example-entries.js#HydratedSelectOverviewExample',
  function HydratedSelectOverviewExample(_handle: Handle) {
    return () => <SelectOverviewExample />
  },
)

export let HydratedSelectDeconstructedExample = clientEntry(
  '/assets/example-entries.js#HydratedSelectDeconstructedExample',
  function HydratedSelectDeconstructedExample(_handle: Handle) {
    return () => <SelectDeconstructedExample />
  },
)

export let HydratedMenuButtonOverviewExample = clientEntry(
  '/assets/example-entries.js#HydratedMenuButtonOverviewExample',
  function HydratedMenuButtonOverviewExample(_handle: Handle) {
    return () => <MenuButtonOverviewExample />
  },
)

export let HydratedMenuButtonBubblingExample = clientEntry(
  '/assets/example-entries.js#HydratedMenuButtonBubblingExample',
  function HydratedMenuButtonBubblingExample(_handle: Handle) {
    return () => <MenuButtonBubblingExample />
  },
)
