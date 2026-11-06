import { belongsTo, column as c, hasMany, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export const sections = table({
  name: 'sections',
  columns: {
    id: c.integer(),
    slug: c.text(),
    name: c.text(),
    position: c.integer(),
  },
})

export const categories = table({
  name: 'categories',
  columns: {
    id: c.integer(),
    section_id: c.integer(),
    slug: c.text(),
    name: c.text(),
    position: c.integer(),
  },
})

export const families = table({
  name: 'families',
  columns: {
    id: c.integer(),
    category_id: c.integer(),
    slug: c.text(),
    name: c.text(),
    description: c.text(),
    // The spec that tells this family's presentations apart, such as "Material"
    presentation_label: c.text(),
    // JSON array naming the parts' spec_1 through spec_4 columns, in order
    spec_names: c.text(),
    // The catalog never changes while the server runs, so totals are computed once when seeding
    part_count: c.integer(),
    lowest_price: c.decimal(10, 2),
    position: c.integer(),
  },
})

export const presentations = table({
  name: 'presentations',
  columns: {
    id: c.integer(),
    family_id: c.integer(),
    slug: c.text(),
    name: c.text(),
    description: c.text(),
    part_count: c.integer(),
    lowest_price: c.decimal(10, 2),
    position: c.integer(),
  },
})

export const parts = table({
  name: 'parts',
  columns: {
    id: c.integer(),
    family_id: c.integer(),
    presentation_id: c.integer(),
    part_number: c.text(),
    spec_1: c.text().nullable(),
    spec_2: c.text().nullable(),
    spec_3: c.text().nullable(),
    spec_4: c.text().nullable(),
    pack_quantity: c.integer(),
    price: c.decimal(10, 2),
    position: c.integer(),
  },
})

export const categoriesBySection = hasMany(sections, categories).orderBy('position', 'asc')
export const familiesByCategory = hasMany(categories, families).orderBy('position', 'asc')
export const presentationsByFamily = hasMany(families, presentations).orderBy('position', 'asc')
export const categoryForFamily = belongsTo(families, categories)
export const familyForPart = belongsTo(parts, families)
export const presentationForPart = belongsTo(parts, presentations)

export type Section = TableRow<typeof sections>
export type Category = TableRow<typeof categories>
export type Family = TableRow<typeof families>
export type Presentation = TableRow<typeof presentations>
export type Part = TableRow<typeof parts>
