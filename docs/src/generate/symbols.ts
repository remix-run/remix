// Ignore auto-linking for APIs of ours that conflict with built in symbols
export const IGNORE_SYMBOLS = new Set([
  'any',
  'array',
  'bigint',
  'boolean',
  'map',
  'number',
  'object',
  'set',
  'string',
  'symbol',
])

export const MDN_SYMBOLS = {
  AbortSignal: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal',
  ArrayBuffer:
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer',
  Blob: 'https://developer.mozilla.org/en-US/docs/Web/API/Blob',
  File: 'https://developer.mozilla.org/en-US/docs/Web/API/File',
  FormData: 'https://developer.mozilla.org/en-US/docs/Web/API/FormData',
  Headers: 'https://developer.mozilla.org/en-US/docs/Web/API/Headers',
  JSON: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON',
  ReadableStream: 'https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream',
  ReadableStreamDefaultReader:
    'https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader',
  Request: 'https://developer.mozilla.org/en-US/docs/Web/API/Request',
  Response: 'https://developer.mozilla.org/en-US/docs/Web/API/Response',
  SubtleCrypto: 'https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto',
  TextDecoder: 'https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder',
  TextEncoder: 'https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder',
  TransformStream: 'https://developer.mozilla.org/en-US/docs/Web/API/TransformStream',
  Uint8Array:
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array',
  URL: 'https://developer.mozilla.org/en-US/docs/Web/API/URL',
  URLSearchParams: 'https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams',
  WritableStream: 'https://developer.mozilla.org/en-US/docs/Web/API/WritableStream',
}
