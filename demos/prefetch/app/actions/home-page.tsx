import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { plainProducts, prefetchedProducts, products, type Product } from '../data/products.ts'
import { routes } from '../routes.ts'
import { ProductCard } from '../ui/product-card.tsx'
import { ProductSearch } from './public/product-search.tsx'

export function HomePage(handle: Handle<{ prefetchMode: 'intent' | 'render' | 'viewport' }>) {
  let searchableProducts = products.map((product) => ({
    name: product.name,
    href: routes.product.href({ slug: product.slug }),
  }))

  return () => (
    <>
      <h1 mix={titleStyle}>Catalog</h1>
      <p mix={introStyle}>
        Every product page takes 800ms to render. Prefetching starts its HTML request in the
        background, followed by hints for its JavaScript and CSS. Choose when it starts below. The
        browser caches responses according to their HTTP headers.
      </p>

      <nav aria-label="Prefetch mode">
        <a
          href={routes.home.href()}
          aria-current={handle.props.prefetchMode === 'intent' ? 'page' : undefined}
        >
          Intent
        </a>{' '}
        <a
          href={routes.home.href(undefined, { searchParams: { prefetch: 'render' } })}
          aria-current={handle.props.prefetchMode === 'render' ? 'page' : undefined}
        >
          Render
        </a>{' '}
        <a
          href={routes.home.href(undefined, { searchParams: { prefetch: 'viewport' } })}
          aria-current={handle.props.prefetchMode === 'viewport' ? 'page' : undefined}
        >
          Viewport
        </a>
      </nav>

      <ProductSearch products={searchableProducts} />

      {handle.props.prefetchMode === 'viewport' ? (
        <p mix={viewportSpacerStyle}>Scroll down to bring the prefetched products into view.</p>
      ) : null}
      <ProductSection
        title={`Prefetched on ${handle.props.prefetchMode}`}
        products={prefetchedProducts}
        prefetch={handle.props.prefetchMode}
      />
      <ProductSection title="Not prefetched" products={plainProducts} />
    </>
  )
}

function ProductSection(
  handle: Handle<{
    title: string
    products: Product[]
    prefetch?: 'intent' | 'render' | 'viewport'
  }>,
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

const viewportSpacerStyle = css({
  minHeight: '100vh',
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
