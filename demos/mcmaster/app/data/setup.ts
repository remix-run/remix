import * as path from 'node:path'
import type { Database } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'

import { catalog } from './catalog.ts'
import type { FamilyDefinition } from './catalog.ts'
import { categories, families, parts, presentations, sections } from './schema.ts'
import { formatSoldAs, soldAsSpecName, toParam } from './specs.ts'

const insertBatchSize = 2000

export function loadCatalogMigrations() {
  return loadMigrations(path.join(import.meta.dirname, '../../db/migrations'))
}

export async function setupDatabase(db: Database): Promise<void> {
  await db.migrate(await loadCatalogMigrations())

  if ((await db.count(sections)) === 0) {
    await seedCatalog(db)
  }
}

export async function seedCatalog(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    let categoryId = 0
    let familyId = 0
    let presentationId = 0
    let partId = 0

    for (let [sectionIndex, section] of catalog.entries()) {
      let sectionId = sectionIndex + 1
      await tx.create(sections, {
        id: sectionId,
        slug: section.slug,
        name: section.name,
        position: sectionIndex,
      })

      for (let [categoryIndex, category] of section.categories.entries()) {
        categoryId++
        await tx.create(categories, {
          id: categoryId,
          section_id: sectionId,
          slug: category.slug,
          name: category.name,
          position: categoryIndex,
        })

        for (let [familyIndex, family] of category.families.entries()) {
          familyId++
          let familyParts = generateParts(family, presentationId)
          let familyPresentations = family.presentations.map((presentation, index) => {
            let presentationParts = familyParts.filter((part) => part.presentationIndex === index)
            return {
              id: presentationId + index + 1,
              family_id: familyId,
              slug: toParam(presentation.name),
              name: presentation.name,
              description: presentation.description,
              part_count: presentationParts.length,
              lowest_price: Math.min(...presentationParts.map((part) => part.price)),
              position: index,
            }
          })
          presentationId += family.presentations.length

          await tx.create(families, {
            id: familyId,
            category_id: categoryId,
            slug: family.slug,
            name: family.name,
            description: family.description,
            presentation_label: family.presentationLabel,
            spec_names: JSON.stringify([...family.specs.map((spec) => spec.name), soldAsSpecName]),
            part_count: familyParts.length,
            lowest_price: Math.min(...familyPresentations.map((row) => row.lowest_price)),
            position: familyIndex,
          })
          await tx.createMany(presentations, familyPresentations)

          for (let start = 0; start < familyParts.length; start += insertBatchSize) {
            let rows = familyParts.slice(start, start + insertBatchSize).map((part) => {
              let [spec_1 = null, spec_2 = null, spec_3 = null, spec_4 = null] = part.specValues
              return {
                id: ++partId,
                family_id: familyId,
                presentation_id: familyPresentations[part.presentationIndex].id,
                part_number: part.partNumber,
                spec_1,
                spec_2,
                spec_3,
                spec_4,
                pack_quantity: part.packQuantity,
                price: part.price,
                position: part.position,
              }
            })
            await tx.createMany(parts, rows)
          }
        }
      }
    }
  })
}

export interface GeneratedPart {
  presentationIndex: number
  partNumber: string
  /** The family's spec values followed by its "Sold As" value. */
  specValues: string[]
  packQuantity: number
  price: number
  /** Order within the presentation. */
  position: number
}

/**
 * Expands a family into one orderable part for every combination of presentation, spec values, and
 * pack size, the same way a real industrial catalog offers each screw in every thread size, length,
 * material, and package quantity.
 *
 * @param family The family to expand.
 * @param firstPresentationIndex How many presentations came before this family in the catalog, so
 *   every presentation gets its own part number series.
 */
export function generateParts(
  family: FamilyDefinition,
  firstPresentationIndex = 0,
): GeneratedPart[] {
  let combinations: number[][] = [[]]
  for (let spec of family.specs) {
    combinations = combinations.flatMap((combination) =>
      spec.values.map((_, valueIndex) => [...combination, valueIndex]),
    )
  }

  return family.presentations.flatMap((_, presentationIndex) => {
    let series = getPartNumberSeries(firstPresentationIndex + presentationIndex)
    let position = 0

    return combinations.flatMap((valueIndexes) =>
      family.packQuantities.map((packQuantity) => {
        let index = position++
        return {
          presentationIndex,
          partNumber:
            series +
            String.fromCharCode(65 + Math.floor(index / 999)) +
            String((index % 999) + 1).padStart(3, '0'),
          specValues: [
            ...valueIndexes.map(
              (valueIndex, specIndex) => family.specs[specIndex].values[valueIndex],
            ),
            formatSoldAs(packQuantity),
          ],
          packQuantity,
          price: calculatePrice(family, presentationIndex, valueIndexes, packQuantity),
          position: index,
        }
      }),
    )
  })
}

// Spreads presentations across four-digit series, like McMaster's 91251A540. Multiplying by a number
// coprime to 9000 visits every series once before repeating.
function getPartNumberSeries(presentationIndex: number): string {
  return String(1000 + ((presentationIndex * 389) % 9000))
}

function calculatePrice(
  family: FamilyDefinition,
  presentationIndex: number,
  valueIndexes: number[],
  packQuantity: number,
): number {
  let unitPrice = valueIndexes.reduce(
    (price, valueIndex, specIndex) => {
      let valueCount = family.specs[specIndex].values.length
      return price * (1 + (valueIndex / Math.max(valueCount - 1, 1)) * 1.2)
    },
    family.basePrice * (1 + presentationIndex * 0.15),
  )
  let packDiscount = packQuantity > 1 ? 0.9 : 1

  return Math.max(0.05, Math.round(unitPrice * packQuantity * packDiscount * 100) / 100)
}
