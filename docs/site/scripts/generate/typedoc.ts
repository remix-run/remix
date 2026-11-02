import * as path from 'node:path'
import * as typedoc from 'typedoc'
import { debug, getApiNameFromFullName, info, invariant, verbose, warn } from './utils.ts'

type Maps = {
  comments: Map<string, typedoc.Reflection> // full name => TypeDoc Reflection
  apisToDocument: Set<string> // APIs we should generate docs for
}

export async function loadTypeDoc(opts: {
  input?: string
  entryPoints?: string
  typedocDir?: string
  tag?: string
}) {
  // Load the full TypeDoc project and walk it to create a lookup map and
  // determine which APIs we want to generate documentation for
  let project = await loadTypedocJson(opts)

  let { comments, apisToDocument } = createLookupMaps(project)

  // Warn if the same name is exported from multiple `@remix-run/*` packages.
  // The umbrella `remix` package is skipped at traversal time so there are no
  // umbrella/source duplicates to dedupe — only genuine cross-package
  // collisions remain (e.g. `Cookie` in both `@remix-run/cookie` and
  // `@remix-run/headers`).
  warnOnCrossPackageCollisions(apisToDocument)

  // Remove aliased APIs and only document the canonicals
  getAliasedAPIs(comments).forEach((name) => apisToDocument.delete(name))

  return { comments, apisToDocument }
}

// Load the TypeDoc JSON representation, either from a JSON file or by running
// TypeDoc against the project
async function loadTypedocJson(opts: {
  input?: string
  entryPoints?: string
  typedocDir?: string
  tag?: string
}): Promise<typedoc.ProjectReflection> {
  if (opts.input) {
    info(`Loading TypeDoc JSON from: ${opts.input}`)
    let app = await typedoc.Application.bootstrap({
      name: 'Remix',
      entryPoints: [opts.input],
      entryPointStrategy: 'merge',
    })
    let reflection = await app.convert()
    invariant(reflection, 'Failed to generate TypeDoc reflection from JSON file')
    return reflection
  } else if (opts.entryPoints && opts.typedocDir) {
    info(`Generating TypeDoc from project`)
    let app = await typedoc.Application.bootstrap({
      name: 'Remix',
      entryPoints: [opts.entryPoints],
      entryPointStrategy: 'packages',
      packageOptions: {
        // Allow custom tags
        blockTags: [...typedoc.OptionDefaults.blockTags, '@alias'],
        // Tag to use in source code links
        gitRevision: opts.tag,
        skipErrorChecking: true,
        // exclude test files via the build config
        tsconfig: 'tsconfig.build.json',
        validation: {
          // Don't warn for referenced but not exported types
          notExported: false,
        },
      },
    })
    let reflection = await app.convert()
    invariant(reflection, 'Failed to generate TypeDoc reflection from source code')

    let outPath = path.resolve(process.cwd(), opts.typedocDir)
    await app.renderer.render(reflection!, outPath)

    let jsonPath = path.join(outPath, 'api.json')
    await app.application.generateJson(reflection, jsonPath)

    info(`HTML docs generated at: ${outPath}`)
    info(`JSON docs generated at: ${jsonPath}`)

    return reflection
  } else {
    throw new Error('Invalid options: must specify either `input` or `entryPoints`/`typedocDir`')
  }
}

// Walk the TypeDoc reflection and collect all APIs we wish to document as well
// as generate a full lookup map of JSDoc comments by API name
export function createLookupMaps(reflection: typedoc.ProjectReflection): Maps {
  let comments = new Map<string, typedoc.Reflection>()
  let apisToDocument = new Set<string>()

  // Reflections we want to traverse through to find documented APIs
  let traverseKinds = new Set<typedoc.ReflectionKind>([
    typedoc.ReflectionKind.Module,
    typedoc.ReflectionKind.Function,
    typedoc.ReflectionKind.CallSignature,
    typedoc.ReflectionKind.Class,
    typedoc.ReflectionKind.Interface,
    typedoc.ReflectionKind.TypeAlias,
    typedoc.ReflectionKind.Variable,
  ])

  recurse(reflection)

  return { comments, apisToDocument }

  function recurse(node: typedoc.Reflection, alias?: string) {
    node.traverse((child) => {
      let apiName = alias || child.getFriendlyFullName()
      apiName = apiName.replace(/\.\.+/g, '.') // Clean up any `..` in top-level remix re-exports

      // Skip the umbrella `remix` package entirely. It is a pure pass-through
      // that re-exports each `@remix-run/*` package; documenting both copies
      // is redundant and is fragile when typedoc resolves the umbrella's
      // re-exports through bundled `.d.ts` files that may have stripped JSDoc.
      // We document the `@remix-run/*` source reflections directly and rewrite
      // their paths to `remix/*` in `getApiFilePath`.
      if (apiName === 'remix' || apiName.startsWith('remix.')) {
        return
      }

      if (child.kind !== typedoc.ReflectionKind.Module) {
        comments.set(apiName, child)
      }

      let indent = '  '.repeat(apiName.split('.').length - 1)
      let logApi = (suffix: string) =>
        verbose(
          [
            `${indent}[${typedoc.ReflectionKind[child.kind]}]`,
            apiName,
            `(${child.id})`,
            `(${suffix})`,
          ].join(' '),
        )

      // Recurse into reference types
      if (child.isReference()) {
        logApi(`reference to ${child.getTargetReflectionDeep().getFriendlyFullName()}`)
        let ref = child.getTargetReflection()
        recurse(ref, child.getFriendlyFullName())
        return
      }

      // Skip nested properties, methods, etc. that we don't intend to document standalone
      if (!traverseKinds.has(child.kind)) {
        logApi(`skipped`)
        return
      }

      // Grab APIs with JSDoc comments that we should generate docs for
      // We don't need comments for types since those can stand alone in the docs
      if (
        child.comment ||
        [typedoc.ReflectionKind.Interface, typedoc.ReflectionKind.TypeAlias].includes(child.kind)
      ) {
        apisToDocument.add(apiName)
        logApi(`commenting`)
      }

      // No need to traverse past signatures, do that when we generate the comment
      if (!child.isSignature()) {
        recurse(child)
      }
    })
  }
}

// Warn when the same short API name is exported from multiple `@remix-run/*`
// packages. The umbrella `remix` package is skipped at traversal time
// (see `createLookupMaps`), so `apisToDocument` only contains source-level
// `@remix-run/*` reflections — no umbrella/duplicate dedup is needed.
function warnOnCrossPackageCollisions(apisToDocument: Set<string>): void {
  let apisByName = new Map<string, string[]>()
  for (let fullName of apisToDocument) {
    let apiName = getApiNameFromFullName(fullName)
    apisByName.set(apiName, [...(apisByName.get(apiName) || []), fullName])
  }
  for (let [apiName, fullNames] of apisByName) {
    if (fullNames.length > 1) {
      warn(`Multiple packages export ${apiName}: ${fullNames.join(', ')}`)
    }
  }
}

function getAliasedAPIs(comments: Map<string, typedoc.Reflection>): Set<string> {
  let aliasedAPIs = new Set<string>()

  comments.forEach((reflection, name) => {
    let parts = name.split('.')
    let apiName = parts.pop()
    let alias = reflection.comment?.blockTags.find((tag) => tag.tag === '@alias')
    if (alias) {
      // The canonical API should include `@alias`
      // We will generate a markdown doc for the canonical API, and not the aliases
      // The canonical doc will list the aliases names
      let aliasName = alias.content.reduce((acc, part) => {
        invariant(part.kind === 'text')
        return acc + part.text
      }, '')
      if (apiName !== aliasName) {
        let aliasFullName = [...parts, aliasName].join('.')
        debug(`Preferring canonical API \`${name}\` over alias \`${aliasFullName}\``)
        aliasedAPIs.add(aliasFullName)
      }
    }
  })

  return aliasedAPIs
}

// Reference TypeDoc types

// export declare enum ReflectionKind {
//     Project = 1,
//     Module = 2,
//     Namespace = 4,
//     Enum = 8,
//     EnumMember = 16,
//     Variable = 32,
//     Function = 64,
//     Class = 128,
//     Interface = 256,
//     Constructor = 512,
//     Property = 1024,
//     Method = 2048,
//     CallSignature = 4096,
//     IndexSignature = 8192,
//     ConstructorSignature = 16384,
//     Parameter = 32768,
//     TypeLiteral = 65536,
//     TypeParameter = 131072,
//     Accessor = 262144,
//     GetSignature = 524288,
//     SetSignature = 1048576,
//     TypeAlias = 2097152,
//     Reference = 4194304,
//     /**
//      * Generic non-ts content to be included in the generated docs as its own page.
//      */
//     Document = 8388608
// }

// export interface ReflectionVariant {
//     declaration: DeclarationReflection;
//     param: ParameterReflection;
//     project: ProjectReflection;
//     reference: ReferenceReflection;
//     signature: SignatureReflection;
//     typeParam: TypeParameterReflection;
//     document: DocumentReflection;
// }
