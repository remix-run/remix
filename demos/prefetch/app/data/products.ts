export interface Product {
  slug: string
  name: string
  price: string
  description: string
}

export const prefetchedProducts: Product[] = [
  {
    slug: 'canvas-tote',
    name: 'Canvas Tote',
    price: '$28',
    description: 'Heavyweight cotton canvas with a reinforced base and an inside pocket.',
  },
  {
    slug: 'enamel-mug',
    name: 'Enamel Mug',
    price: '$18',
    description: 'A speckled camp mug that holds 12 ounces and survives the trail.',
  },
  {
    slug: 'wool-beanie',
    name: 'Wool Beanie',
    price: '$32',
    description: 'Ribbed merino knit that stays warm without the itch.',
  },
  {
    slug: 'field-notebook',
    name: 'Field Notebook',
    price: '$12',
    description: 'Forty-eight pages of dot grid paper bound in a kraft cover.',
  },
]

export const plainProducts: Product[] = [
  {
    slug: 'brass-keyring',
    name: 'Brass Keyring',
    price: '$16',
    description: 'Solid brass that darkens into a warm patina over time.',
  },
  {
    slug: 'linen-apron',
    name: 'Linen Apron',
    price: '$45',
    description: 'Stonewashed linen with adjustable straps and two deep pockets.',
  },
  {
    slug: 'cedar-coasters',
    name: 'Cedar Coasters',
    price: '$22',
    description: 'A set of four coasters cut from aromatic red cedar.',
  },
  {
    slug: 'wax-candle',
    name: 'Beeswax Candle',
    price: '$24',
    description: 'Hand-poured beeswax with a cotton wick and a 40-hour burn.',
  },
]

export const products = [...prefetchedProducts, ...plainProducts]

export function findProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug)
}
