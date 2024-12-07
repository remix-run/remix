// Re-export all core functionality
export {
  getMultipartBoundary,
  MultipartParseError,
  type MultipartParserOptions,
  MultipartParser,
  MultipartPart,
} from './lib/multipart.ts';

// Export Node.js-specific functionality
export { isMultipartRequest, parseMultipartRequest, parseMultipart } from './lib/multipart.node.ts';
