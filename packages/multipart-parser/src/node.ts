// Re-export all core functionality
export type { ParseMultipartOptions, MultipartParserOptions } from './lib/multipart.ts'
export {
  MultipartParseError,
  MaxHeaderSizeExceededError,
  MaxFileSizeExceededError,
  MultipartParser,
  MultipartPart,
} from './lib/multipart.ts'

export { getMultipartBoundary } from './lib/multipart-request.ts'

// Export Node.js-specific functionality
export {
  isMultipartRequest,
  parseMultipartRequest,
  parseMultipart,
  parseMultipartStream,
} from './lib/multipart.node.ts'
