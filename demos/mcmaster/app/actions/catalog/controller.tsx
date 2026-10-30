import { createController } from 'remix/router'

import {
  categories,
  categoryForFamily,
  families,
  familiesByCategory,
  familyForPart,
  parts,
  presentationForPart,
  presentationsByFamily,
} from '../../data/schema.ts'
import { getSpecColumns, getSpecValues } from '../../data/specs.ts'
import { routes } from '../../routes.ts'
import { getPreloadableImage, getProductPhoto, getThumbnail } from '../product-images.ts'
import { renderPage, type PageContext } from '../render-page.tsx'
import { CategoryPage } from './category-page.tsx'
import { loadFamilyFilters } from './family-filters.ts'
import { FamilyPage, type PresentationSection } from './family-page.tsx'
import { NotFound } from './not-found.tsx'
import { PartPage } from './part-page.tsx'

/** Rows shown for each presentation when the page lists all of them. */
const previewRowLimit = 30
/** Rows shown when a visitor narrows the page to a single presentation. */
const fullRowLimit = 300
/** Presentations near the top of the page load their photos right away. */
const eagerImageCount = 2

export default createController(routes.catalog, {
  actions: {
    async category(context) {
      let { db, params } = context
      let category = await db.findOne(categories, {
        where: { slug: params.category },
        with: { families: familiesByCategory },
      })

      if (category == null) {
        return renderNotFound(context)
      }

      let familySummaries = await Promise.all(
        category.families.map(async (family) => ({
          family,
          image: await getThumbnail(getProductPhoto(family.slug), 112),
          specNames: getSpecColumns(family).map((column) => column.name),
        })),
      )

      return renderPage(context, {
        title: category.name,
        content: <CategoryPage category={category} families={familySummaries} />,
        cache: 'shared',
      })
    },

    async family(context) {
      let { db, params, url } = context
      let family = await db.findOne(families, {
        where: { slug: params.family },
        with: { category: categoryForFamily, presentations: presentationsByFamily },
      })

      if (family?.category == null || family.category.slug !== params.category) {
        return renderNotFound(context)
      }

      let columns = getSpecColumns(family)
      let { filters, selection, matchCounts } = await loadFamilyFilters(
        db,
        family,
        family.presentations,
        columns,
        url.searchParams,
      )
      let shownPresentations = family.presentations.filter(
        (presentation) =>
          (selection.presentationId == null || presentation.id === selection.presentationId) &&
          (matchCounts.get(presentation.id) ?? 0) > 0,
      )
      let rowLimit = selection.presentationId == null ? previewRowLimit : fullRowLimit

      let sections: PresentationSection[] = await Promise.all(
        shownPresentations.map(async (presentation, index) => {
          let photo = getProductPhoto(family.slug, presentation.slug)
          let rows = await db.findMany(parts, {
            where: { presentation_id: presentation.id, ...selection.specs },
            orderBy: ['position', 'asc'],
            limit: rowLimit,
          })

          return {
            presentation,
            // The first photo is preloaded, so it uses the same single URL as its preload link.
            image:
              index === 0 ? await getPreloadableImage(photo, 96) : await getThumbnail(photo, 96),
            eager: index < eagerImageCount,
            matchCount: matchCounts.get(presentation.id) ?? 0,
            parts: rows.map((part) => ({ ...part, specValues: getSpecValues(part, columns) })),
          }
        }),
      )

      return renderPage(context, {
        title: family.name,
        content: (
          <FamilyPage
            family={family}
            category={family.category}
            columns={columns}
            filters={filters}
            sections={sections}
            singlePresentation={selection.presentationId != null}
            url={url}
          />
        ),
        cache: 'shared',
      })
    },

    async part(context) {
      let { db, params } = context
      let part = await db.findOne(parts, {
        where: { part_number: params.partNumber },
        with: {
          family: familyForPart.with({ category: categoryForFamily }),
          presentation: presentationForPart,
        },
      })

      if (part?.family?.category == null || part.presentation == null) {
        return renderNotFound(context)
      }

      let columns = getSpecColumns(part.family)

      return renderPage(context, {
        title: `${part.family.name} ${part.part_number}`,
        content: (
          <PartPage
            part={part}
            image={await getPreloadableImage(
              getProductPhoto(part.family.slug, part.presentation.slug),
              256,
            )}
            family={part.family}
            presentation={part.presentation}
            category={part.family.category}
            columns={columns}
            specValues={getSpecValues(part, columns)}
          />
        ),
        cache: 'shared',
      })
    },
  },
})

function renderNotFound(context: PageContext) {
  return renderPage(context, {
    title: 'Not found',
    content: <NotFound />,
    cache: 'shared',
    status: 404,
  })
}
