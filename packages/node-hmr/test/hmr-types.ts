import type { ImportMetaHot as RuntimeImportMetaHot } from '../src/lib/runtime.ts'
import type {} from '../src/types.d.ts'

type Assert<constraint extends true> = constraint
type AmbientImportMetaHot = NonNullable<ImportMeta['hot']>

type _AmbientMatchesRuntime = Assert<
  AmbientImportMetaHot extends RuntimeImportMetaHot
    ? RuntimeImportMetaHot extends AmbientImportMetaHot
      ? true
      : false
    : false
>
