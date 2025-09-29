import type { RequestContext } from '@remix-run/fetch-router'

export function searchHandler({ url }: RequestContext) {
  let query = url.searchParams.get('q') || ''
  let type = url.searchParams.get('type') || 'all'
  let limit = parseInt(url.searchParams.get('limit') || '10')

  let results = performSearch(query, type, limit)

  return new Response(
    JSON.stringify({
      query,
      type,
      results,
      total: results.length,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

function performSearch(query: string, type: string, limit: number) {
  // Mock search results
  let allResults = [
    { type: 'book', id: '1', title: 'The Great Novel', author: 'Author One' },
    { type: 'book', id: '2', title: 'Programming Guide', author: 'Author Two' },
    { type: 'author', id: 'author-1', name: 'Author One', bookCount: 5 },
    { type: 'blog', id: 'getting-started', title: 'Getting Started with Reading' },
    { type: 'blog', id: 'best-books-2024', title: 'Best Books of 2024' },
  ]

  let filtered = allResults.filter((item) => {
    let matchesQuery =
      !query ||
      item.title?.toLowerCase().includes(query.toLowerCase()) ||
      item.name?.toLowerCase().includes(query.toLowerCase())

    let matchesType = type === 'all' || item.type === type

    return matchesQuery && matchesType
  })

  return filtered.slice(0, limit)
}
