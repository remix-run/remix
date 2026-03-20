export {
  type FileUploadHandler,
  type ParseFormDataOptions,
  FormDataParseError,
  MaxFilesExceededError,
  FileUpload,
  parseFormData,
} from './lib/form-data.ts'

// Re-export errors that may be thrown by the parser.
export {
  MultipartParseError,
  MaxHeaderSizeExceededError,
  MaxFileSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
} from '@remix-run/multipart-parser'
