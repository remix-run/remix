import type { AST } from './ast.ts'
import * as Part from '../part/index.ts'

type Variant = {
  key: Array<Array<string>>
  paramNames: Array<string>
}

export function* variants(pattern: AST): Generator<Variant> {
  let protocols = pattern.protocol ? Part.variants(pattern.protocol) : undefined
  let hostnames = pattern.hostname ? Part.variants(pattern.hostname) : undefined
  let pathnames = pattern.pathname ? Part.variants(pattern.pathname) : undefined

  for (let protocol of protocols ?? [null]) {
    for (let hostname of hostnames ?? [null]) {
      for (let pathname of pathnames ?? [null]) {
        yield {
          key: [
            protocol ? [protocol.key] : [],
            hostname?.key.split('.').reverse() ?? [],
            pathname?.key.split('/') ?? [],
          ],
          paramNames: [
            ...(protocol?.paramNames ?? []),
            ...(hostname?.paramNames ?? []),
            ...(pathname?.paramNames ?? []),
          ],
        }
      }
    }
  }
}
