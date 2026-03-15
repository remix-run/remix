import type { Controller } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { EXAMPLES } from './index.tsx'
import { ExampleDocument } from './view.tsx'

function renderExample(example: (typeof EXAMPLES)[keyof typeof EXAMPLES]) {
  return render(<ExampleDocument example={example} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

let examplesController: Controller<typeof routes.examples> = {
  actions: {
    textOverview() {
      return renderExample(EXAMPLES.overviewText)
    },
    cardOverview() {
      return renderExample(EXAMPLES.overviewCard)
    },
    buttonAliases() {
      return renderExample(EXAMPLES.buttonAliases)
    },
    fieldStack() {
      return renderExample(EXAMPLES.fieldStack)
    },
    itemStatus() {
      return renderExample(EXAMPLES.itemStatus)
    },
    navOverview() {
      return renderExample(EXAMPLES.navOverview)
    },
    rowStack() {
      return renderExample(EXAMPLES.rowStack)
    },
    textPageTypography() {
      return renderExample(EXAMPLES.textPageTypography)
    },
    cardStructuredSurface() {
      return renderExample(EXAMPLES.cardStructuredSurface)
    },
    buttonBaseSizeTone() {
      return renderExample(EXAMPLES.buttonBaseSizeTone)
    },
    buttonSizes() {
      return renderExample(EXAMPLES.buttonSizes)
    },
    buttonSlotsStates() {
      return renderExample(EXAMPLES.buttonSlotsStates)
    },
    navDetail() {
      return renderExample(EXAMPLES.navDetail)
    },
  },
}

export default examplesController
