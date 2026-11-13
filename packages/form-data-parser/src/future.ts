export {
  type ParseFormDataOptions,
  FormDataParseError,
  MaxFilesExceededError,
} from './lib/form-data.ts'
export { type FileUploadHandler, FileUpload, parseFormData } from './lib/future/form-data.ts'

// Re-export errors that may be thrown by the parser.
export {
  MultipartParseError,
  MaxHeaderSizeExceededError,
  MaxFileSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
} from '@remix-run/multipart-parser/future'
