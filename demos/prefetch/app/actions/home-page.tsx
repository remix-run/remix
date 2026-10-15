import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { plainProducts, prefetchedProducts, products, type Product } from '../data/products.ts'
import { routes } from '../routes.ts'
import { ProductCard } from '../ui/product-card.tsx'
import { ProductSearch } from './public/product-search.tsx'

export function HomePage() {
  let searchableProducts = products.map((product) => ({
    name: product.name,
    href: routes.product.href({ slug: product.slug }),
  }))

  return () => (
    <>
      <h1 mix={titleStyle}>Catalog</h1>
      <p mix={introStyle}>
        Every product page takes 800ms to render. Hover, focus, or press a prefetched product and
        its page loads in the background, so opening it is instant.
      </p>

      <ProductSearch products={searchableProducts} />

      <ProductSection title="Prefetched on intent" products={prefetchedProducts} prefetch />
      <ProductSection title="Not prefetched" products={plainProducts} />
    </>
  )
}

function ProductSection(
  handle: Handle<{ title: string; products: Product[]; prefetch?: boolean }>,
) {
  return () => (
    <section mix={sectionStyle}>
      <h2 mix={sectionTitleStyle}>{handle.props.title}</h2>
      <div mix={gridStyle}>
        {handle.props.products.map((product) => (
          <ProductCard key={product.slug} product={product} prefetch={handle.props.prefetch} />
        ))}
      </div>
    </section>
  )
}

const titleStyle = css({
  margin: '0 0 0.5rem',
})

const introStyle = css({
  margin: '0 0 2rem',
  maxWidth: '40rem',
  lineHeight: 1.6,
  color: '#57534e',
})

const sectionStyle = css({
  marginTop: '2rem',
})

const sectionTitleStyle = css({
  margin: '0 0 0.75rem',
  fontSize: '1rem',
})

const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
  gap: '0.75rem',
})
