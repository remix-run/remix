import type { Controller } from 'remix/fetch-router'

import { render } from '../../config/render.tsx'
import type { routes } from '../../config/routes.ts'
import { PAGES } from './data.ts'
import { ExplorerDocument } from './view.tsx'

function renderPage(page: (typeof PAGES)[keyof typeof PAGES]) {
  return render(<ExplorerDocument page={page} />, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

let explorerController: Controller<typeof routes.explorer> = {
  actions: {
    index() {
      return renderPage(PAGES.overview)
    },
    proofSheet() {
      return renderPage(PAGES.proofSheet)
    },
    glyphs() {
      return renderPage(PAGES.glyphs)
    },
    componentAccordion() {
      return renderPage(PAGES.componentAccordion)
    },
    componentBreadcrumbs() {
      return renderPage(PAGES.componentBreadcrumbs)
    },
    componentPopover() {
      return renderPage(PAGES.componentPopover)
    },
    componentListbox() {
      return renderPage(PAGES.componentListbox)
    },
    themeTokens: {
      actions: {
        space() {
          return renderPage(PAGES.themeTokenSpace)
        },
        radius() {
          return renderPage(PAGES.themeTokenRadius)
        },
        typography() {
          return renderPage(PAGES.themeTokenTypography)
        },
        colors() {
          return renderPage(PAGES.themeTokenColors)
        },
        shadow() {
          return renderPage(PAGES.themeTokenShadow)
        },
        motion() {
          return renderPage(PAGES.themeTokenMotion)
        },
        control() {
          return renderPage(PAGES.themeTokenControl)
        },
      },
    },
    uiRecipes: {
      actions: {
        text() {
          return renderPage(PAGES.uiMixinText)
        },
        card() {
          return renderPage(PAGES.uiMixinCard)
        },
        button() {
          return renderPage(PAGES.uiMixinButton)
        },
        field() {
          return renderPage(PAGES.uiMixinField)
        },
        item() {
          return renderPage(PAGES.uiMixinItem)
        },
        layout() {
          return renderPage(PAGES.uiMixinLayout)
        },
        navigation() {
          return renderPage(PAGES.uiMixinNav)
        },
      },
    },
    components() {
      return renderPage(PAGES.components)
    },
    layouts() {
      return renderPage(PAGES.layouts)
    },
  },
}

export default explorerController
