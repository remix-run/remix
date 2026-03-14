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
          return renderPage(PAGES.uiRecipeText)
        },
        card() {
          return renderPage(PAGES.uiRecipeCard)
        },
        button() {
          return renderPage(PAGES.uiRecipeButton)
        },
        field() {
          return renderPage(PAGES.uiRecipeField)
        },
        item() {
          return renderPage(PAGES.uiRecipeItem)
        },
        layout() {
          return renderPage(PAGES.uiRecipeLayout)
        },
        navigation() {
          return renderPage(PAGES.uiRecipeNav)
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
