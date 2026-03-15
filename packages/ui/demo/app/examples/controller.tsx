import type { Controller } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { EXAMPLES } from './index.tsx'
import { ExampleDocument } from './view.tsx'

function renderExample(
  example: (typeof EXAMPLES)[keyof typeof EXAMPLES],
  options?: { pad?: boolean },
) {
  return render(<ExampleDocument example={example} pad={options?.pad ?? false} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

let examplesController: Controller<typeof routes.examples> = {
  actions: {
    accordionOverview({ url }) {
      return renderExample(EXAMPLES.accordionOverview, {
        pad: url.searchParams.has('pad'),
      })
    },
    accordionCard({ url }) {
      return renderExample(EXAMPLES.accordionCard, {
        pad: url.searchParams.has('pad'),
      })
    },
    accordionMultiple({ url }) {
      return renderExample(EXAMPLES.accordionMultiple, {
        pad: url.searchParams.has('pad'),
      })
    },
    breadcrumbsBasic({ url }) {
      return renderExample(EXAMPLES.breadcrumbsBasic, {
        pad: url.searchParams.has('pad'),
      })
    },
    breadcrumbsSeparator({ url }) {
      return renderExample(EXAMPLES.breadcrumbsSeparator, {
        pad: url.searchParams.has('pad'),
      })
    },
    breadcrumbsDecomposed({ url }) {
      return renderExample(EXAMPLES.breadcrumbsDecomposed, {
        pad: url.searchParams.has('pad'),
      })
    },
    textOverview({ url }) {
      return renderExample(EXAMPLES.overviewText, {
        pad: url.searchParams.has('pad'),
      })
    },
    cardOverview({ url }) {
      return renderExample(EXAMPLES.overviewCard, {
        pad: url.searchParams.has('pad'),
      })
    },
    buttonAliases({ url }) {
      return renderExample(EXAMPLES.buttonAliases, {
        pad: url.searchParams.has('pad'),
      })
    },
    fieldStack({ url }) {
      return renderExample(EXAMPLES.fieldStack, {
        pad: url.searchParams.has('pad'),
      })
    },
    itemStatus({ url }) {
      return renderExample(EXAMPLES.itemStatus, {
        pad: url.searchParams.has('pad'),
      })
    },
    navOverview({ url }) {
      return renderExample(EXAMPLES.navOverview, {
        pad: url.searchParams.has('pad'),
      })
    },
    rowStack({ url }) {
      return renderExample(EXAMPLES.rowStack, {
        pad: url.searchParams.has('pad'),
      })
    },
    textPageTypography({ url }) {
      return renderExample(EXAMPLES.textPageTypography, {
        pad: url.searchParams.has('pad'),
      })
    },
    cardStructuredSurface({ url }) {
      return renderExample(EXAMPLES.cardStructuredSurface, {
        pad: url.searchParams.has('pad'),
      })
    },
    buttonBaseSizeTone({ url }) {
      return renderExample(EXAMPLES.buttonBaseSizeTone, {
        pad: url.searchParams.has('pad'),
      })
    },
    buttonSizes({ url }) {
      return renderExample(EXAMPLES.buttonSizes, {
        pad: url.searchParams.has('pad'),
      })
    },
    buttonSlotsStates({ url }) {
      return renderExample(EXAMPLES.buttonSlotsStates, {
        pad: url.searchParams.has('pad'),
      })
    },
    navDetail({ url }) {
      return renderExample(EXAMPLES.navDetail, {
        pad: url.searchParams.has('pad'),
      })
    },
  },
}

export default examplesController
