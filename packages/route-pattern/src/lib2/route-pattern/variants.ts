import type { AST } from './ast.ts'
import * as PartPattern from '../part-pattern/index.ts'

type Tuple4<T> = [protocol: T, hostname: T, port: T, pathname: T]

type Variant = {
  key: Tuple4<Array<string>>
  paramIndices: Set<number>
}

export function* variants(pattern: AST): Generator<Variant> {
  let protocols = pattern.protocol ? PartPattern.variants(pattern.protocol) : [undefined]
  let hostnames = pattern.hostname ? PartPattern.variants(pattern.hostname) : [undefined]
  let pathnames = pattern.pathname ? PartPattern.variants(pattern.pathname) : [undefined]

  for (let protocol of protocols) {
    for (let hostname of hostnames) {
      for (let pathname of pathnames) {
        let paramIndices: Array<number> = []

        if (protocol) {
          protocol.paramIndices.forEach((index) => paramIndices.push(index))
        }

        if (hostname) {
          let offset = paramIndices.length
          hostname.paramIndices.forEach((index) => paramIndices.push(offset + index))
        }

        if (pathname) {
          let offset = paramIndices.length
          pathname.paramIndices.forEach((index) => paramIndices.push(offset + index))
        }

        yield {
          key: [
            protocol ? [protocol.key] : [],
            hostname?.key.split('.').reverse() ?? [],
            pattern.port ? [pattern.port] : [],
            pathname?.key.split('/') ?? [],
          ],
          paramIndices: new Set(paramIndices),
        }
      }
    }
  }
}
