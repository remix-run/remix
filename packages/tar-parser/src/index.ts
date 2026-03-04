import './globals.ts'

export {
  TarParseError,
  type TarArchiveSource,
  type TarEntryHandler,
  type TarHeader,
  type ParseTarHeaderOptions,
  parseTarHeader,
  type ParseTarOptions,
  parseTar,
  type TarParserOptions,
  TarParser,
  TarEntry,
} from './lib/tar.ts'
