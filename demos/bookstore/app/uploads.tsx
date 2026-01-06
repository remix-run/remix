import type { BuildAction } from 'remix'
import { createFileResponse as sendFile } from 'remix'

import type { routes } from './routes.ts'
import { uploadsStorage } from './utils/uploads.ts'

export let uploadsAction: BuildAction<'GET', typeof routes.uploads> = async ({
  request,
  params,
}) => {
  let file = await uploadsStorage.get(params.key)

  if (!file) {
    return new Response('File not found', { status: 404 })
  }

  return sendFile(file, request, {
    cacheControl: 'public, max-age=31536000',
  })
}
