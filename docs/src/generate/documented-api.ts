import * as typedoc from 'typedoc'
import { getApiNameFromFullName, invariant, unimplemented, warn } from './utils.ts'
import { MDN_SYMBOLS } from './symbols.ts'

export type DocumentedAPI =
  | DocumentedFunction
  | DocumentedClass
  | DocumentedInterface
  | DocumentedInterfaceFunction
  | DocumentedType

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

// Fields required for all types
type BaseDocumentedAPI = {
  type: 'function' | 'class' | 'interface' | 'interface-function' | 'type'
  path: string
  source: string | undefined
  name: string
  aliases: string[] | undefined
  description: string
}

// Documented function API
export type DocumentedFunction = BaseDocumentedAPI & {
  type: 'function'
  signature: string
  parameters: ParameterOrProperty[]
  returns: string | undefined
  example: string | undefined
}

// Documented class API
export type DocumentedClass = BaseDocumentedAPI & {
  type: 'class'
  constructor: Method | undefined
  properties: ParameterOrProperty[] | undefined
  methods: Method[] | undefined
  example: string | undefined
}

// Documented interface API
export type DocumentedInterface = BaseDocumentedAPI & {
  type: 'interface'
  signature: string
  properties: ParameterOrProperty[] | undefined
  methods: Method[] | undefined
}

export type DocumentedInterfaceFunction = BaseDocumentedAPI & {
  type: 'interface-function'
  signature: string
  parameters: ParameterOrProperty[]
  returns: string | undefined
}

// Documented type API
export type DocumentedType = BaseDocumentedAPI & {
  type: 'type'
  signature: string
}

// PAth docs are served at on the website
const WEBSITE_DOCS_PATH = '/api'

// Convert a typedoc reflection for a given node into a documentable instance
export function getDocumentedAPI(fullName: string, node: typedoc.Reflection): DocumentedAPI {
  try {
    let api: DocumentedAPI | undefined
    if (node.isSignature()) {
      if (node.parent.kind === typedoc.ReflectionKind.Function) {
        api = getDocumentedFunction(fullName, node)
      } else if (node.parent.kind === typedoc.ReflectionKind.Interface) {
        api = getDocumentedInterfaceFunction(fullName, node)
      }
    } else if (node.isDeclaration()) {
      if (node.kind === typedoc.ReflectionKind.Class) {
        api = getDocumentedClass(fullName, node)
      } else if (node.kind === typedoc.ReflectionKind.Interface) {
        api = getDocumentedInterface(fullName, node)
      } else if (node.kind === typedoc.ReflectionKind.TypeAlias) {
        api = getDocumentedType(fullName, node)
      }
    }

    if (!api) {
      throw new Error(`Unsupported documented API kind: ${typedoc.ReflectionKind[node.kind]}`)
    }

    warnOnInvalidImportSyntax(api)

    return api
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
    path: getApiFilePath(fullName, 'function'),
    source: node.sources?.[0]?.url,
    name: method.name,
    aliases: getApiAliases(node.comment!),
    description: method.description,
    signature: method.signature,
    example: node.comment?.getTag('@example')?.content
      ? processApiComment(node.comment.getTag('@example')!.content)
      : undefined,
    parameters: method.parameters,
    returns: method.returns,
  }
}

function getDocumentedInterfaceFunction(
  fullName: string,
  node: typedoc.SignatureReflection,
): DocumentedInterfaceFunction {
  return {
    ...getDocumentedFunction(fullName, node),
    type: 'interface-function',
  }
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

  let name = getApiNameFromFullName(fullName)

  return {
    type: 'class',
    path: getApiFilePath(fullName, 'class'),
    source: node.sources?.[0]?.url,
    name,
    aliases: getApiAliases(node.comment!),
    description: getApiDescription(node.comment!),
    example: node.comment?.getTag('@example')?.content
      ? processApiComment(node.comment.getTag('@example')!.content)
      : undefined,
    constructor,
    properties,
    methods,
  }
}

function getChildrenSignature(node: typedoc.DeclarationReflection): string {
  let childrenSignature = ''
  node.traverse((c) => {
    if (c.isTypeParameter()) {
      return
    }
    if (c.kind === typedoc.ReflectionKind.Property) {
      let childSignature = c.toString().replace(/^Property /, '')
      if (c.flags.isOptional) {
        childSignature = childSignature.replace(/: /, '?: ')
      }
      childrenSignature += `  ${childSignature}\n`
    } else if (c.kind === typedoc.ReflectionKind.Method && c.isDeclaration()) {
      let method = getApiMethod(c.name, c.getAllSignatures()[0])
      invariant(method, `Failed to get method for type/interface: ${c.getFriendlyFullName()}`)
      childrenSignature += `  ${method.signature}\n`
    }
  })
  return childrenSignature
}

function getDocumentedInterface(
  fullName: string,
  node: typedoc.DeclarationReflection,
): DocumentedInterface {
  let { properties, methods } = getApiPropertiesAndMethods(fullName, node)

  let signature = node.toString().replace(/^Interface/, 'interface')
  let childrenSignature = getChildrenSignature(node)
  if (childrenSignature) {
    signature += ` {\n${childrenSignature}\n}`
  }

  return {
    type: 'interface',
    path: getApiFilePath(fullName, 'interface'),
    source: node.sources?.[0]?.url,
    name: getApiNameFromFullName(fullName),
    aliases: getApiAliases(node.comment!),
    description: getApiDescription(node.comment!),
    signature,
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
  let childrenSignature = getChildrenSignature(node)
  if (childrenSignature) {
    signature += ` = {\n${childrenSignature}\n}`
  }

  return {
    type: 'type',
    path: getApiFilePath(fullName, 'type'),
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

function getApiFilePath(fullName: string, type: DocumentedAPI['type']): string {
  let nameParts = fullName.split('.')
  let name = nameParts.pop()
  return [...nameParts.map((s) => s.replace(/^@remix-run\//g, '')), type, `${name}.md`].join('/')
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

function processApiComment(parts: typedoc.CommentDisplayPart[]): string {
  return parts.reduce((acc, part) => {
    let transformed = part.text
    if (part.kind === 'inline-tag' && part.tag === '@link') {
      let target = part.target
      let href
      if (target) {
        if (target instanceof typedoc.ReflectionSymbolId) {
          // If it's a symbol typedoc knows about it'll find it in the typescript
          // lib and we can use one of our MDN links
          if (target.packageName === 'typescript') {
            if (MDN_SYMBOLS.hasOwnProperty(target.qualifiedName)) {
              let href = MDN_SYMBOLS[target.qualifiedName as keyof typeof MDN_SYMBOLS]!
              transformed = `[\`${part.text}\`](${href})`
            } else {
              warn('Missing MDN link for TypeScript symbol: ', target.qualifiedName)
            }
          } else {
            throw new Error(`Unsupported @link target: ${target.qualifiedName}`)
          }
        } else if (target instanceof typedoc.Reflection) {
          // prettier-ignore
          let type: DocumentedAPI['type'] | null =
            target.kind === typedoc.ReflectionKind.Function ? 'function' :
            target.kind === typedoc.ReflectionKind.Class ? 'class' :
            target.kind === typedoc.ReflectionKind.TypeAlias ? 'type' :
            target.kind === typedoc.ReflectionKind.TypeLiteral ? 'type' :
            target.kind === typedoc.ReflectionKind.Interface ? 'interface' : null;

          if (!type) {
            throw new Error(`Unsupported @link target kind: ${typedoc.ReflectionKind[target.kind]}`)
          }

          let path = getApiFilePath(target.getFriendlyFullName(), type).replace(/\.md$/, '')
          href = `${WEBSITE_DOCS_PATH}/${path}`
          transformed = `[\`${part.text}\`](${href})`
        } else {
          throw new Error(`Missing/invalid target for @link content: ${part.text}`)
        }
      }
    }

    return acc + transformed
  }, '')
}

function warnOnInvalidImportSyntax(api: DocumentedAPI) {
  let str = JSON.stringify(api)
  if (str.includes("from '@remix-run/") || str.includes('from "@remix-run/')) {
    warn(
      `Potential invalid import syntax in ${api.name} JSDoc. Prefer importing ` +
        `from \`remix/*\` instead of \`@remix-run/*\`.`,
    )
  }
}
