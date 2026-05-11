import { createController } from 'remix/fetch-router'

import { routes } from '../../config/routes.ts'
import { AIRPORTS, searchAirports } from './airports.ts'

function parseLimit(url: URL) {
  let value = url.searchParams.get('limit')
  if (!value) {
    return null
  }

  let limit = parseInt(value, 10)
  if (!Number.isFinite(limit) || limit < 1) {
    return null
  }

  return Math.min(limit, 500)
}

const apiController = createController(routes.api, {
  actions: {
    airports({ url }) {
      let query = url.searchParams.get('query') ?? url.searchParams.get('q') ?? ''
      let limit = parseLimit(url)
      let airports = searchAirports(query)
      if (limit !== null) {
        airports = airports.slice(0, limit)
      }

      return Response.json(
        {
          airports,
          query,
          returned: airports.length,
          total: AIRPORTS.length,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300',
          },
        },
      )
    },
  },
})

export default apiController
