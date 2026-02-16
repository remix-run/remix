import type { Assert, IsEqual } from './test-utils.ts'
import type { InferMatchGlobEngine } from './types.ts'

export type InferMatchGlobEngineTests = [
  // Simple engine routing contract (includes star-only + basic)
  // - literals and wildcard-only patterns
  Assert<IsEqual<InferMatchGlobEngine<'app/routes/index.tsx'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'**'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/**'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/images/**/*.*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'assets/**/*.{jpg,jpeg,png,gif}'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'**/.env*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'*.png'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'v*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'*.*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'a?b'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'src/{routes,components}/**/*.ts'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'src/{routes,components}/**/*.{ts,tsx}'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'src/*.{ts,tsx}'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/*.@(ts|tsx)', { noext: true }>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'src/*.{ts,tsx}', { nobrace: true }>, 'simple'>>,

  // Advanced engine routing contract
  // - classes
  Assert<IsEqual<InferMatchGlobEngine<'app/logo[0-9].png'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/logo[!0-9].png'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/logo[[:digit:]].png'>, 'advanced'>>,
  // - escapes
  Assert<IsEqual<InferMatchGlobEngine<'app/\\*.png'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/\\?.png'>, 'advanced'>>,
  // - extglobs
  Assert<IsEqual<InferMatchGlobEngine<'app/*.@(ts|tsx)'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/*.?(ts|tsx)'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/*.+(ts|tsx)'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/*.!(test)'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/*.*(map)'>, 'advanced'>>,

  // Option-driven routing changes
  Assert<IsEqual<InferMatchGlobEngine<'app/*.?(ts|tsx)', { noext: true }>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/logo[0-9].png', { noext: true }>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/\\*.png', { noext: true }>, 'advanced'>>,

  // Snapshot routing for core corpus
  Assert<IsEqual<InferMatchGlobEngine<'app/**'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/images/**/*.*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'assets/**/*.{jpg,jpeg,png,gif}'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'**/.env*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'*.png'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'v*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'*.*'>, 'simple'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/*.?(ts|tsx)'>, 'advanced'>>,
  Assert<IsEqual<InferMatchGlobEngine<'app/logo[0-9].png'>, 'advanced'>>,
]
