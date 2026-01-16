import fs from 'node:fs/promises'
import path from 'node:path'
import util from 'node:util'
import * as typedoc from 'typedoc'
import * as prettier from 'prettier'

//#region Types

// Function parameter or Class property
type ParameterOrProperty = {
  name: string
  type: string
  description: string
}

// Class Method
type Method = {
  name: string
  signature: string
  description: string
  parameters: ParameterOrProperty[]
  returns: string | undefined
}

// Documented function API
type DocumentedFunction = Method & {
  type: 'function'
  path: string
  source: string | undefined
  aliases: string[] | undefined
  example: string | undefined
}

// Documented class API
type DocumentedClass = {
  type: 'class'
  path: string
  source: string | undefined
  name: string
  aliases: string[] | undefined
  description: string
  example: string | undefined
  constructor: Method | undefined
  properties: ParameterOrProperty[] | undefined
  methods: Method[] | undefined
}

// Documented interface API
type DocumentedInterface = {
  type: 'interface'
  path: string
  source: string | undefined
  name: string
  aliases: string[] | undefined
  description: string
  properties: ParameterOrProperty[] | undefined
  methods: Method[] | undefined
}

type DocumentedInterfaceFunction = Omit<DocumentedFunction, 'type'> & {
  type: 'interface-function'
}

// Documented interface API
type DocumentedType = {
  type: 'type'
  path: string
  source: string | undefined
  name: string
  aliases: string[] | undefined
  description: string
  signature: string
}

type DocumentedAPI =
  | DocumentedFunction
  | DocumentedClass
  | DocumentedInterface
  | DocumentedInterfaceFunction
  | DocumentedType

type Maps = {
  comments: Map<string, typedoc.Reflection> // full name => TypeDoc Reflection
  apisToDocument: Set<string> // APIs we should generate docs for
}

//#region CLI

let { values: cliArgs } = util.parseArgs({
  options: {
    // Enable additional debugging logs
    debug: {
      type: 'boolean',
      short: 'd',
    },
    // Path to a TypeDoc JSON file to use as the input, instead of running Typedoc
    // (mutually exclusive with `entryPoints`)
    input: {
      type: 'string',
      short: 'i',
    },
    // Entrypoints to run typedoc against (mutually exclusive with `input`)
    entryPoints: {
      type: 'string',
      short: 'i',
      default: '../packages/*',
    },
    // Specific module to generate docs for
    module: {
      type: 'string',
      short: 'm',
    },
    // Specific api to generate docs for
    api: {
      type: 'string',
      short: 'a',
    },
    // Output directory for generated API markdown files
    docsDir: {
      type: 'string',
      short: 'o',
      default: 'api',
    },
    // Output directory for typedoc JSON (if --input is not specified)
    typedocDir: {
      type: 'string',
      short: 'o',
      default: 'typedoc',
    },
    // Base path (without trailing slash) for docs website, used for link generation
    websiteDocsPath: {
      type: 'string',
      short: 'w',
      default: '/api',
    },
  },
})

main()

async function main() {
  // Ensure we're running from the /docs directory
  let cwd = process.cwd()
  if (!cwd.endsWith('/docs')) {
    console.error('❌ This script must be run from the /docs directory')
    process.exit(1)
  }

  console.log(`Clearing output directory: ${cliArgs.docsDir}`)
  await fs.rm(cliArgs.docsDir, { recursive: true, force: true })

  // Load the full TypeDoc project and walk it to create a lookup map and
  // determine which APIs we want to generate documentation for
  let project = await loadTypedocJson()
  let { comments, apisToDocument } = createLookupMaps(project)

  // Prefer `remix` package exports over other package exports
  getDuplicateAPIs(apisToDocument).forEach((name) => apisToDocument.delete(name))

  // Remove aliased APIs and only document the canonicals
  getAliasedAPIs(comments).forEach((name) => apisToDocument.delete(name))

  // Parse JSDocs into DocumentedAPI instances we can write out to markdown
  let documentedAPIs = [...apisToDocument].map((name) =>
    getDocumentedAPI(name, comments.get(name)!),
  )

  // Write out docs
  await writeMarkdownFiles(documentedAPIs)
  info('Documentation generation complete!')
}

//#region TypeDoc

// Load the TypeDoc JSON representation, either from a JSON file or by running
// TypeDoc against the project
async function loadTypedocJson(): Promise<typedoc.ProjectReflection> {
  if (cliArgs.input) {
    info(`Loading TypeDoc JSON from: ${cliArgs.input}`)
    let app = await typedoc.Application.bootstrap({
      name: 'Remix',
      entryPoints: [cliArgs.input],
      entryPointStrategy: 'merge',
    })
    let reflection = await app.convert()
    invariant(reflection, 'Failed to generate TypeDoc reflection from JSON file')
    return reflection
  }

  info(`Generating TypeDoc from project`)
  let app = await typedoc.Application.bootstrap({
    name: 'Remix',
    entryPoints: [cliArgs.entryPoints],
    entryPointStrategy: 'packages',
    packageOptions: {
      blockTags: [...typedoc.OptionDefaults.blockTags, '@alias'],
    },
  })
  let reflection = await app.convert()
  invariant(reflection, 'Failed to generate TypeDoc reflection from source code')

  let outPath = path.resolve(process.cwd(), cliArgs.typedocDir)
  await app.renderer.render(reflection!, outPath)
  info(`HTML docs generated at: ${outPath}`)

  let jsonPath = path.join(outPath, 'api.json')
  await app.application.generateJson(reflection, jsonPath)
  info(`JSON docs generated at: ${jsonPath}`)

  return reflection
}

// Walk the TypeDoc reflection and collect all APIs we wish to document as well
// as generate a full lookup map of JSDoc comments by API name
function createLookupMaps(reflection: typedoc.ProjectReflection): Maps {
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
    // TODO: Not implemented yet - used for interactions like arrowLeft etc. so
    // we eventually will probably want to support
    // typedoc.ReflectionKind.Variable,
  ])

  recurse(reflection)

  return { comments, apisToDocument }

  function recurse(node: typedoc.Reflection, alias?: string) {
    node.traverse((child) => {
      if (
        cliArgs.module &&
        child.kind === typedoc.ReflectionKind.Module &&
        child.name !== cliArgs.module
      ) {
        info('Skipping module due to --module flag: ' + child.name)
        return
      }

      let apiName = alias || child.getFriendlyFullName()
      apiName = apiName.replace(/\.\.+/g, '.') // Clean up any `..` in top-level remix re-exports

      if (child.kind !== typedoc.ReflectionKind.Module) {
        comments.set(apiName, child)
      }

      let indent = '  '.repeat(apiName.split('.').length - 1)
      let logApi = (suffix: string) =>
        debug(
          [
            `${indent}[${typedoc.ReflectionKind[child.kind]}]`,
            apiName,
            `(${child.id})`,
            `(${suffix})`,
          ].join(' '),
        )

      // Reference types are aliases - stick them off into a separate map for post-processing
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
      if (child.comment && (!cliArgs.api || child.name === cliArgs.api)) {
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

// Deduplicate APIs that are exported from multiple packages, preferring the remix package
function getDuplicateAPIs(apisToDocument: Set<string>): Set<string> {
  let apisByName = new Map<string, string[]>()
  let duplicates = new Set<string>()

  // Group APIs by short name
  for (let fullName of apisToDocument) {
    let apiName = getApiNameFromFullName(fullName)
    apisByName.set(apiName, [...(apisByName.get(apiName) || []), fullName])
  }

  // Process each group of APIs with the same name
  for (let [apiName, fullNames] of apisByName) {
    if (fullNames.length <= 1) {
      continue
    }

    let remixAPI = fullNames.find(
      (name) => name.split('.').length === 2 && name.split('.')[0] === 'remix',
    )
    let deepRemixAPIs = fullNames.filter(
      (name) => name.split('.').length > 2 && name.split('.')[0] === 'remix',
    )
    let nonRemixAPIs = fullNames.filter((name) => name.split('.')[0] !== 'remix')

    if (remixAPI) {
      // Remove non-remix APIs, keep the remix one
      for (let api of [...deepRemixAPIs, ...nonRemixAPIs]) {
        debug(`Preferring \`remix\` export for ${apiName}, removing: ${api}`)
        duplicates.add(api)
      }
    } else if (deepRemixAPIs.length > 0) {
      // Remove non-remix APIs, keep the remix/* one
      for (let api of nonRemixAPIs) {
        debug(`Preferring \`${deepRemixAPIs[0]}\` export, removing: ${api}`)
        duplicates.add(api)
      }
    } else if (fullNames.length > 1) {
      // Multiple non-remix packages export this API
      warn(`Multiple packages export ${apiName}: ${fullNames.join(', ')}`)
    }
  }

  return duplicates
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

//#region DocumentedAPI

// Convert a typedoc reflection for a given node into a documentable instance
function getDocumentedAPI(fullName: string, node: typedoc.Reflection): DocumentedAPI {
  try {
    if (node.isSignature()) {
      if (node.parent.kind === typedoc.ReflectionKind.Function) {
        return getDocumentedFunction(fullName, node)
      } else if (node.parent.kind === typedoc.ReflectionKind.Interface) {
        return getDocumentedInterfaceFunction(fullName, node)
      }
    } else if (node.isDeclaration()) {
      if (node.kind === typedoc.ReflectionKind.Class) {
        return getDocumentedClass(fullName, node)
      } else if (node.kind === typedoc.ReflectionKind.Interface) {
        return getDocumentedInterface(fullName, node)
      } else if (node.kind === typedoc.ReflectionKind.TypeAlias) {
        return getDocumentedType(fullName, node)
      }
    }

    throw new Error(`Unsupported documented API kind: ${typedoc.ReflectionKind[node.kind]}`)
  } catch (e) {
    throw new Error(
      `Error normalizing comment for ${node.getFriendlyFullName()}: ${(e as Error).message}`,
      {
        cause: e,
      },
    )
  }
}

function getDocumentedFunction(
  fullName: string,
  node: typedoc.SignatureReflection,
): DocumentedFunction {
  let method = getApiMethod(fullName, node)
  invariant(method, `Failed to get method for function: ${node.getFriendlyFullName()}`)
  return {
    type: 'function',
    path: getApiFilePath(fullName),
    source: node.sources?.[0]?.url,
    aliases: getApiAliases(node.comment!),
    example: node.comment?.getTag('@example')?.content
      ? processApiComment(node.comment.getTag('@example')!.content)
      : undefined,
    ...method,
  }
}

function getDocumentedInterfaceFunction(
  fullName: string,
  node: typedoc.SignatureReflection,
): DocumentedInterfaceFunction {
  let { type, ...fn } = getDocumentedFunction(fullName, node)
  return {
    type: 'interface-function',
    name: fn.name,
    signature: fn.signature,
    description: fn.description,
    parameters: fn.parameters,
    returns: fn.returns,
    example: fn.example,
    path: fn.path,
    source: fn.source,
    aliases: fn.aliases,
  } satisfies DocumentedInterfaceFunction
}

function getDocumentedClass(
  fullName: string,
  node: typedoc.DeclarationReflection,
): DocumentedClass {
  let constructor: Method | undefined
  node.traverse((child) => {
    if (child.isDeclaration() && child.kind === typedoc.ReflectionKind.Constructor) {
      let signature = child.getAllSignatures()[0]
      invariant(signature, `Missing constructor signature for class: ${node.getFriendlyFullName()}`)
      constructor = getApiMethod(fullName, signature)
    }
  })

  let { properties, methods } = getApiPropertiesAndMethods(
    fullName,
    node,
    new Set([typedoc.ReflectionKind.Constructor]),
  )

  return {
    type: 'class',
    aliases: getApiAliases(node.comment!),
    example: undefined,
    path: getApiFilePath(fullName),
    source: node.sources?.[0]?.url,
    name: getApiNameFromFullName(fullName),
    description: getApiDescription(node.comment!),
    constructor,
    properties,
    methods,
  }
}

function getDocumentedInterface(
  fullName: string,
  node: typedoc.DeclarationReflection,
): DocumentedInterface {
  let { properties, methods } = getApiPropertiesAndMethods(fullName, node)
  return {
    type: 'interface',
    path: getApiFilePath(fullName),
    source: node.sources?.[0]?.url,
    name: getApiNameFromFullName(fullName),
    aliases: getApiAliases(node.comment!),
    description: getApiDescription(node.comment!),
    properties,
    methods,
  }
}

function getDocumentedType(fullName: string, node: typedoc.DeclarationReflection): DocumentedType {
  let name = getApiNameFromFullName(fullName)

  //TODO: We my need to do manual signature construction for types with generics
  //
  // The `Action` type here:
  //   https://github.com/remix-run/remix/blob/ffdd2740b07b9c90518617b78831c255fa8aadd6/packages/fetch-router/src/lib/controller.ts#L40
  //
  //   type Action<method extends RequestMethod | 'ANY', pattern extends string> =
  //     | RequestHandlerWithMiddleware<method, pattern>
  //     | RequestHandler<method, Params<pattern>>
  //
  // Results in this via `toString()` and loses the generic `extends` stuff:
  //
  //   type Action<method, pattern> =
  //     | RequestHandlerWithMiddleware<method, pattern>
  //     | RequestHandler<method, Params<pattern>>;

  let signature = node
    .toString()
    .replace(/^TypeAlias/, 'type')
    .replace(new RegExp(`(${name}(<.*>)?): `), `$1 = `)

  let childrenSignature = ''
  node.traverse((c) => {
    if (c.isTypeParameter()) {
      return
    }
    let childSignature = c.toString().replace(/^Property /, '')
    if (c.flags.isOptional) {
      childSignature = childSignature.replace(/: /, '?: ')
    }
    childrenSignature += `  ${childSignature}\n`
  })

  if (childrenSignature) {
    signature += ` = {\n${childrenSignature}\n}`
  }

  return {
    type: 'type',
    path: getApiFilePath(fullName),
    source: node.sources?.[0]?.url,
    name,
    aliases: getApiAliases(node.comment!),
    description: getApiDescription(node.comment!),
    signature,
  }
}

function getApiAliases(typedocComment: typedoc.Comment): string[] | undefined {
  let tags = typedocComment.getTags('@alias')
  if (!tags || tags.length === 0) {
    return undefined
  }
  return tags.map((tag) => {
    return tag.content.reduce((acc, part) => {
      invariant(
        part.kind === 'text',
        `Invalid @alias tag content: ${typedocComment.getTags('@alias').join(', ')}`,
      )
      return acc + part.text
    }, '')
  })
}

function getApiFilePath(fullName: string): string {
  let nameParts = fullName.split('.')
  let name = nameParts.pop()
  return [...nameParts.map((s) => s.replace(/^@remix-run\//g, '')), `${name}.md`].join('/')
}

function getApiDescription(typedocComment: typedoc.Comment): string {
  let description = typedocComment.summary
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()
  return description
}

function getApiPropertiesAndMethods(
  fullName: string,
  node: typedoc.DeclarationReflection,
  handledTypes: Set<typedoc.ReflectionKind> = new Set(),
): {
  properties: ParameterOrProperty[]
  methods: Method[]
} {
  let properties: ParameterOrProperty[] = []
  let methods: Method[] = []
  node.traverse((child) => {
    if (child.isDeclaration()) {
      if (child.kind === typedoc.ReflectionKind.Property) {
        let property = getApiParameterOrProperty(child)
        if (property) {
          properties.push(property)
        }
      } else if (child.kind === typedoc.ReflectionKind.Accessor) {
        let property = getApiParameterOrProperty(child.getSignature)
        if (property) {
          properties.push(property)
        }
      } else if (child.kind === typedoc.ReflectionKind.Method) {
        let signature = child.getAllSignatures()[0]
        invariant(`Missing method signature for class: ${child.getFriendlyFullName()}`)
        let method = getApiMethod(fullName, signature)
        if (method) {
          methods.push(method)
        }
      } else if (!handledTypes.has(child.kind)) {
        unimplemented(
          `class child kind: ${typedoc.ReflectionKind[child.kind]} ${node.getFriendlyFullName()}`,
        )
      }
    }
  })
  return { properties, methods }
}

function getApiMethod(fullName: string, node: typedoc.SignatureReflection): Method | undefined {
  let parameters: ParameterOrProperty[] = []
  node.traverse((child) => {
    // Only process params, not type params (generics)
    if (child.isParameter()) {
      parameters = parameters.concat(getApiParameters(child))
    } else if (child.isSignature()) {
      child.traverse((param) => {
        // Only process params, not type params (generics)
        if (param.isParameter()) {
          parameters = parameters.concat(getApiParameters(param))
        }
      })
    }
  })

  if (!node.comment) {
    warn(`missing comment for signature: ${node.getFriendlyFullName()}`)
  } else if (!node.comment.summary) {
    warn(`missing summary for signature: ${node.getFriendlyFullName()}`)
  }

  let returnType = node.type ? node.type.toString() : 'void'
  let signatureParams = parameters.map((p) => `${p.name}: ${p.type}`).join(', ')

  let signature: string
  if (node.parent.kind === typedoc.ReflectionKind.Function) {
    signature = `function ${node.name}(${signatureParams}): ${returnType}`
  } else if (node.parent.kind === typedoc.ReflectionKind.Interface) {
    signature = [`interface ${node.name} {`, `(${signatureParams}): ${returnType}`, `}`].join('\n')
  } else if (node.parent.kind === typedoc.ReflectionKind.Constructor) {
    signature = `constructor${node.name}(${signatureParams}): ${returnType}`
  } else if (node.parent.kind === typedoc.ReflectionKind.Method) {
    signature = `${node.name}(${signatureParams}): ${returnType}`
  } else {
    invariant(
      false,
      `Unhandled parent kind for method signature: ${typedoc.ReflectionKind[node.parent.kind]}`,
    )
  }

  return {
    name: getApiNameFromFullName(fullName),
    signature,
    description: node.comment?.summary ? processApiComment(node.comment.summary) : '',
    parameters,
    returns: node.comment?.getTag('@returns')?.content
      ? processApiComment(node.comment.getTag('@returns')!.content)
      : undefined,
  }
}

// Get one or more parameters to document for a single function param.
// Results in multiple params when the function param is an object with nested
// fields. For example: `func(options: { a: boolean, b: string })`
function getApiParameters(
  node: typedoc.ParameterReflection | typedoc.ReferenceReflection,
): ParameterOrProperty[] {
  if (!node.isReference()) {
    let param = getApiParameterOrProperty(node)
    return param ? [param] : []
  }

  let api = node.getTargetReflectionDeep()

  if (!api || api.kind === typedoc.ReflectionKind.TypeParameter) {
    return []
  }

  // For now, we assume the class will be documented on it's own and we can just cross-link
  // TODO: Cross-link to the class
  if (api.kind === typedoc.ReflectionKind.Class) {
    let param = getApiParameterOrProperty(node)
    return param ? [param] : []
  }

  // Expand out individual fields of interfaces
  if (api.kind === typedoc.ReflectionKind.Interface) {
    let params: ParameterOrProperty[] = []
    let param = getApiParameterOrProperty(node)
    if (param) {
      params.push(param)
    }

    api.traverse((child) => {
      if (child.isDeclaration()) {
        let childParam = getApiParameterOrProperty(child, [node.name])
        if (childParam) {
          params.push(childParam)
        } else {
          warn(`Missing comment for parameter: ${child.name} in ${api.getFriendlyFullName()}`)
        }
      }
    })

    return params
  }

  if (api.kind === typedoc.ReflectionKind.TypeAlias) {
    let param = getApiParameterOrProperty(node)
    return param ? [param] : []
  }

  throw new Error(`Unhandled parameter kind: ${typedoc.ReflectionKind[api.kind]}`)
}

function getApiParameterOrProperty(
  node:
    | typedoc.ParameterReflection
    | typedoc.DeclarationReflection
    | typedoc.SignatureReflection
    | undefined,
  prefix: string[] = [],
): ParameterOrProperty | undefined {
  invariant(node, 'Invalid node for comment')
  return {
    name: [...prefix, node.name].join('.'),
    type: node.type ? node.type.toString() : 'unknown',
    description: node.comment?.summary ? processApiComment(node.comment.summary) : '',
  }
}

function getApiNameFromFullName(fullName: string): string {
  return fullName.split('.').slice(-1)[0]
}

function processApiComment(parts: typedoc.CommentDisplayPart[]): string {
  return parts.reduce((acc, part) => {
    let text = part.text
    if (part.kind === 'inline-tag' && part.tag === '@link') {
      let target = part.target
      invariant(
        target && target instanceof typedoc.Reflection,
        `Missing/invalid target for @link content: ${part.text}`,
      )
      let path = getApiFilePath(target.getFriendlyFullName()).replace(/\.md$/, '')
      let href = `${cliArgs.websiteDocsPath}/${path}`
      text = `[\`${part.text}\`](${href})`
    }
    return acc + text
  }, '')
}

//#region Markdown

async function writeMarkdownFiles(comments: DocumentedAPI[]) {
  for (let comment of comments) {
    let mdPath = path.join(cliArgs.docsDir, comment.path)
    await fs.mkdir(path.dirname(mdPath), { recursive: true })
    debug('Writing markdown file:', mdPath)
    if (comment.type === 'function') {
      await fs.writeFile(mdPath, await getFunctionMarkdown(comment))
    } else if (comment.type === 'class') {
      await fs.writeFile(mdPath, await getClassMarkdown(comment))
    } else if (comment.type === 'interface') {
      await fs.writeFile(mdPath, await getInterfaceMarkdown(comment))
    } else if (comment.type === 'interface-function') {
      await fs.writeFile(mdPath, await getInterfaceFunctionMarkdown(comment))
    } else if (comment.type === 'type') {
      await fs.writeFile(mdPath, await getTypeMarkdown(comment))
    }
  }
}

const h = (level: number, heading: string, body?: string) =>
  `${'#'.repeat(level)} ${heading}${body ? `\n\n${body}` : ''}`
const h1 = (heading: string) => h(1, heading)
const h2 = (heading: string, body: string) => h(2, heading, body)
const h3 = (heading: string, body: string) => h(3, heading, body)
const h4 = (heading: string, body: string) => h(4, heading, body)
const code = (content: string) => `\`${content}\``
const p = (content: string) => `${content}`
const pre = async (content: string, lang = 'ts') => {
  if (content.includes('(...)')) {
    // Prettier chokes on the ellipsis syntax in function signatures
    warn(
      'Skipping formatting for code block with ellipsis syntax: ',
      content.substring(0, 50) + '...',
    )
  } else {
    try {
      content = await prettier.format(content, { parser: 'typescript' })
    } catch (e) {
      warn(
        'Failed to format code block, using unformatted content: ',
        content.length > 30 ? content.substring(0, 30) + '...' : content,
      )
      debug(e)
    }
  }
  return `\`\`\`${lang}\n${content}\n\`\`\``
}

function frontmatter(comment: DocumentedAPI) {
  return ['---', `title: ${comment.name}`, `type: ${comment.type}`, '---'].join('\n')
}

function name(comment: DocumentedAPI) {
  return h1(comment.name)
}

function source(comment: DocumentedAPI) {
  return comment.source ? p(`[View Source](${comment.source})`) : undefined
}

function summary(comment: DocumentedAPI) {
  return h2('Summary', comment.description)
}

function aliases(comment: DocumentedAPI) {
  return comment.aliases ? h2('Aliases', comment.aliases.join(', ')) : undefined
}
async function getFunctionMarkdown(comment: DocumentedFunction): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
    comment.example
      ? h2(
          'Example',
          comment.example.trim().startsWith('```') ? comment.example : await pre(comment.example),
        )
      : undefined,
    comment.parameters.length > 0
      ? h2(
          'Params',
          comment.parameters.map((param) => h3(code(param.name), param.description)).join('\n\n'),
        )
      : undefined,
    comment.returns ? h2('Returns', comment.returns) : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getClassMarkdown(comment: DocumentedClass): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    comment.example ? h2('Example', comment.example) : undefined,
    comment.constructor
      ? h2(
          'Constructor',
          [
            comment.constructor.description,
            ...comment.constructor.parameters.map((p) => h3(code(p.name), p.description)),
          ]
            .filter(Boolean)
            .join('\n\n'),
        )
      : undefined,
    comment.properties && comment.properties.length > 0
      ? h2(
          'Properties',
          comment.properties.map((p) => h3(code(p.name), p.description)).join('\n\n'),
        )
      : undefined,
    comment.methods && comment.methods.length > 0
      ? h2(
          'Methods',
          comment.methods
            .map((m) =>
              [
                h3(code(m.signature), m.description),
                ...m.parameters.map((p) => h4(p.name, p.description)),
              ].join('\n\n'),
            )
            .join('\n\n'),
        )
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getInterfaceMarkdown(comment: DocumentedInterface): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    comment.properties && comment.properties.length > 0
      ? h2(
          'Properties',
          comment.properties.map((p) => h3(code(p.name), p.description)).join('\n\n'),
        )
      : undefined,
    comment.methods && comment.methods.length > 0
      ? h2(
          'Methods',
          comment.methods
            .map((m) =>
              [
                h3(code(m.signature), m.description),
                ...m.parameters.map((p) => h4(p.name, p.description)),
              ].join('\n\n'),
            )
            .join('\n\n'),
        )
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getInterfaceFunctionMarkdown(comment: DocumentedInterfaceFunction): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
    comment.example
      ? h2(
          'Example',
          comment.example.trim().startsWith('```') ? comment.example : await pre(comment.example),
        )
      : undefined,
    comment.parameters.length > 0
      ? h2(
          'Params',
          comment.parameters.map((param) => h3(code(param.name), param.description)).join('\n\n'),
        )
      : undefined,
    comment.returns ? h2('Returns', comment.returns) : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getTypeMarkdown(comment: DocumentedType): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
  ]
    .filter(Boolean)
    .join('\n\n')
}

//#region utils

function debug(...args: unknown[]) {
  if (cliArgs.debug) {
    console.debug('🛠️', ...args)
  }
}

function info(...args: unknown[]) {
  console.log('ℹ️', ...args)
}

function warn(...args: unknown[]) {
  console.warn('⚠️', ...args)
}

function unimplemented(...args: unknown[]) {
  console.error('‼️', 'Unimplemented:', ...args)
}

function invariant(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Invariant violation')
  }
}

//#region Reference

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
