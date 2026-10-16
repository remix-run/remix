import type { Handle } from 'remix/component'
import { clientEntry, css, on, prefetch } from 'remix/component'

type SearchableProduct = {
  name: string
  href: string
}

export const ProductSearch = clientEntry(
  import.meta.url,
  function ProductSearch(handle: Handle<{ products: SearchableProduct[] }>) {
    let query = ''

    return () => {
      let matches = findMatches(handle.props.products, query)

      return (
        <div mix={searchStyle}>
          <label for={handle.id} mix={labelStyle}>
            Search products
          </label>
          <input
            id={handle.id}
            type="search"
            placeholder="Try “mug”"
            mix={[
              inputStyle,
              on('input', (event) => {
                query = event.currentTarget.value.trim()
                handle.update()

                // Once the search narrows to one product, start loading its page.
                let nextMatches = findMatches(handle.props.products, query)
                if (nextMatches.length === 1) prefetch(nextMatches[0].href)
              }),
            ]}
          />
          {query && (
            <ul mix={resultsStyle}>
              {matches.map((product) => (
                <li key={product.href}>
                  <a href={product.href}>{product.name}</a>
                </li>
              ))}
              {matches.length === 0 && <li>No products match “{query}”</li>}
            </ul>
          )}
        </div>
      )
    }
  },
)

function findMatches(products: SearchableProduct[], query: string): SearchableProduct[] {
  if (!query) return []
  let normalizedQuery = query.toLowerCase()
  return products.filter((product) => product.name.toLowerCase().includes(normalizedQuery))
}

const searchStyle = css({
  display: 'grid',
  gap: '0.5rem',
  maxWidth: '24rem',
})

const labelStyle = css({
  fontWeight: 600,
})

const inputStyle = css({
  padding: '0.6rem 0.75rem',
  border: '1px solid #d6d3d1',
  borderRadius: '8px',
  font: 'inherit',
})

const resultsStyle = css({
  margin: 0,
  paddingLeft: '1.25rem',
  lineHeight: 1.8,
})
