import * as path from 'node:path'

import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'

export async function fileResponse(
  request: Request,
  filePath: string,
  name = path.basename(filePath),
): Promise<Response> {
  return createFileResponse(openLazyFile(filePath, { name }), request)
}
