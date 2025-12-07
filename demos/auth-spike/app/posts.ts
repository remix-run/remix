import type { RouteHandlers } from '@remix-run/fetch-router'
import { routes } from './routes.ts'
import { requireUser } from './utils/auth.ts'
import { createRedirectResponse } from '@remix-run/response/redirect'
import { toggleLike } from './models/posts.ts'

export default {
  like: {
    async handler({ params, url }) {
      let user = requireUser(url)
      if (user instanceof Response) return user

      let postId = params.id

      if (!postId) {
        return createRedirectResponse(routes.home.href())
      }

      toggleLike(postId, user.id)

      return createRedirectResponse(routes.home.href())
    },
  },
} satisfies RouteHandlers<typeof routes.posts>
