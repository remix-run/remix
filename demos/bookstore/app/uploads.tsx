import type { BuildRouteHandler } from '@remix-run/fetch-router'
import { createFileResponse as sendFile } from '@remix-run/response/file'

import type { routes } from '../routes.ts'
import { uploadsStorage } from './utils/uploads.ts'

export let uploadsHandler: BuildRouteHandler<'GET', typeof routes.uploads> = async ({
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
