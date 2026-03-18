import { clientEntry, type Handle } from 'remix/component'

import AccordionCardExample from '../examples/components/accordion-card.tsx'
import AccordionMultipleExample from '../examples/components/accordion-multiple.tsx'
import AccordionOverviewExample from '../examples/components/accordion-overview.tsx'
import AnchorExample from '../examples/components/anchor.tsx'
import ListboxControlledExample from '../examples/components/listbox-controlled.tsx'
import ListboxOverviewExample from '../examples/components/listbox-overview.tsx'
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

export let HydratedListboxControlledExample = clientEntry(
  '/assets/example-entries.js#HydratedListboxControlledExample',
  function HydratedListboxControlledExample(_handle: Handle) {
    return () => <ListboxControlledExample />
  },
)
