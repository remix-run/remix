// Re-export all core functionality
export {
  MultipartParseError,
  type MultipartParserOptions,
  MultipartParser,
  MultipartPart,
} from './lib/multipart.ts';

export { getMultipartBoundary } from './lib/multipart-request.ts';

// Export Node.js-specific functionality
export { isMultipartRequest, parseMultipartRequest, parseMultipart } from './lib/multipart.node.ts';
