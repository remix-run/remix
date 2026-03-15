// @jsxRuntime classic
// @jsx createElement
import { clientEntry, createElement, type Handle } from 'remix/component'

import AccordionCardExample from '../examples/components/accordion-card.tsx'
import AccordionMultipleExample from '../examples/components/accordion-multiple.tsx'
import AccordionOverviewExample from '../examples/components/accordion-overview.tsx'

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
