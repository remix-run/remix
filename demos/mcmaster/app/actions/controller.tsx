import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { categoriesBySection, familiesByCategory, sections } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { parseSpeedSettings, serializeSpeedSettings } from '../utils/speed-settings.ts'
import { HomePage } from './home-page.tsx'
import { getProductPhoto, getThumbnail } from './product-images.ts'
import { renderPage } from './render-page.tsx'
import { getReturnPath } from './return-path.ts'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let response = await assets.fetch(request)
      return response ?? new Response('Not found', { status: 404 })
    },

    async home(context) {
      let catalogSections = await context.db.findMany(sections, {
        orderBy: ['position', 'asc'],
        with: { categories: categoriesBySection.with({ families: familiesByCategory }) },
      })
      let homeSections = await Promise.all(
        catalogSections.map(async (section) => ({
          ...section,
          categories: await Promise.all(
            section.categories.map(async (category) => ({
              ...category,
              image: await getThumbnail(getProductPhoto(category.families[0].slug), 64),
            })),
          ),
        })),
      )

      return renderPage(context, {
        title: 'Industrial parts, delivered fast',
        content: <HomePage sections={homeSections} />,
        cache: 'shared',
      })
    },

    async settings({ formData, request }) {
      let settings = parseSpeedSettings(formData)

      return redirect(getReturnPath(request, routes.home.href()), {
        status: 303,
        headers: { 'Set-Cookie': await serializeSpeedSettings(settings) },
      })
    },
  },
})
