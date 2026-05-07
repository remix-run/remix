import * as typedoc from 'typedoc'
import { getApiNameFromFullName, invariant, unimplemented, warn } from './utils.ts'
import { MDN_SYMBOLS } from './symbols.ts'

export type DocumentedAPI =
  | DocumentedFunction
  | DocumentedClass
  | DocumentedInterface
  | DocumentedInterfaceFunction
  | DocumentedType
  | DocumentedVariable
  | DocumentedVariableFunction

// Function parameter or Class property
export type ParameterOrProperty = {
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
  type:
    | 'function'
    | 'class'
    | 'interface'
    | 'interface-function'
    | 'type'
    | 'variable'
    | 'variable-function'
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
  signature: string
  constructor: Method | undefined
  properties: ParameterOrProperty[] | undefined
  accessors: ParameterOrProperty[] | undefined
  methods: Method[] | undefined
  example: string | undefined
}

// Documented interface API
export type DocumentedInterface = BaseDocumentedAPI & {
  type: 'interface'
  signature: string
  properties: ParameterOrProperty[] | undefined
  accessors: ParameterOrProperty[] | undefined
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

// Optional sidebar bucket override. When set, the variable lives at
// `<package>/mixin/<Name>.md` instead of `<package>/variable/<Name>.md` and
// is grouped under "Mixins" in the website sidebar. Authors opt in via
// `@category mixin` in the variable's JSDoc.
const VARIABLE_CATEGORIES = ['mixin'] as const

// Documented variable API
export type DocumentedVariable = BaseDocumentedAPI & {
  type: 'variable'
  signature: string
  example: string | undefined
  category: (typeof VARIABLE_CATEGORIES)[number] | undefined
}

// Documented variable API for variables whose type resolves to a callable
export type DocumentedVariableFunction = BaseDocumentedAPI & {
  type: 'variable-function'
  signature: string
  parameters: ParameterOrProperty[]
  returns: string | undefined
  example: string | undefined
}

// Path docs are served at on the website
export const WEBSITE_DOCS_PATH = '/api'

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
      } else if (node.kind === typedoc.ReflectionKind.Variable) {
        let signatures = getVariableCallSignatures(node)
        api =
          signatures.length > 0
            ? getDocumentedVariableFunction(fullName, node, signatures)
            : getDocumentedVariable(fullName, node)
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
  let comment = node.comment
  let method = getApiMethod(fullName, node)
  invariant(method, `Failed to get method for function: ${node.getFriendlyFullName()}`)
  let methods = [method]
  let signature = method.signature
  let parameters = method.parameters

  // For overloaded functions, collect all signatures and merge parameters
  if (node.parent.signatures && node.parent.signatures.length > 1) {
    comment = node.parent.signatures.find((s) => s.comment)?.comment || comment
    methods = node.parent.signatures
      .map((s) => getApiMethod(fullName, s))
      .filter((m): m is Method => m != null)

    signature = methods.map((m) => m.signature).join('\n\n')

    // Deduplicate parameters across overloads by name (first occurrence wins)
    methods
      .flatMap((m) => m.parameters)
      .forEach((param) => {
        if (!parameters.some((p) => p.name === param.name)) {
          parameters.push(param)
        }
      })
  }

  return {
    type: 'function',
    path: getApiFilePath(fullName, 'function'),
    source: node.sources?.[0]?.url,
    name: method.name,
    aliases: comment ? getApiAliases(comment) : undefined,
    description: comment ? getApiDescription(comment) : '',
    signature,
    example: comment?.getTag('@example')?.content
      ? processApiComment(comment.getTag('@example')!.content)
      : undefined,
    parameters,
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
      invariant(
        child.getAllSignatures().length === 1,
        `Docs only support one constructor signature at the moment: ${child.getFriendlyFullName()}`,
      )
      let signature = child.getAllSignatures()[0]
      invariant(signature, `Missing constructor signature for class: ${node.getFriendlyFullName()}`)
      constructor = getApiMethod(fullName, signature)
    }
  })

  let { properties, accessors, methods } = getApiPropertiesAndMethods(
    fullName,
    node,
    new Set([typedoc.ReflectionKind.Constructor]),
  )

  let name = getApiNameFromFullName(fullName)
  let classDecl = node.toString().replace(/^Class /, 'class ')
  let signature = `${classDecl} {\n${getClassBodySignature(node)}}`

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
    signature,
    constructor,
    properties,
    accessors,
    methods,
  }
}

function getClassBodySignature(node: typedoc.DeclarationReflection): string {
  let constructorLine
  let propertiesLine
  let accessorsLine
  let methodsLine

  constructorLine = getChildrenSignature(node, (c) => c.kind === typedoc.ReflectionKind.Constructor)
  propertiesLine = getChildrenSignature(node, (c) => c.kind === typedoc.ReflectionKind.Property)
  accessorsLine = getChildrenSignature(node, (c) => c.kind === typedoc.ReflectionKind.Accessor)
  methodsLine = getChildrenSignature(node, (c) => c.kind === typedoc.ReflectionKind.Method)

  return [
    constructorLine,
    propertiesLine ? ['  // Properties', propertiesLine].join('\n') : undefined,
    accessorsLine ? ['  // Accessors', accessorsLine].join('\n') : undefined,
    methodsLine ? ['  // Methods', methodsLine].join('\n') : undefined,
  ]
    .flat()
    .filter(Boolean)
    .join('\n')
}

function getChildrenSignature(
  node: typedoc.DeclarationReflection,
  predicate?: (c: typedoc.Reflection) => boolean,
): string {
  let childrenSignature = ''
  node.traverse((c) => {
    if (c.isTypeParameter() || predicate?.(c) === false) {
      return
    }
    if (c.kind === typedoc.ReflectionKind.Property) {
      let childSignature = c.toString().replace(/^Property /, '')
      if (c.flags.isOptional) {
        childSignature = childSignature.replace(/: /, '?: ')
      }
      childrenSignature += `  ${childSignature}\n`
    } else if (c.kind === typedoc.ReflectionKind.Accessor && c.isDeclaration() && c.getSignature) {
      let type = c.getSignature.type?.toString() ?? 'unknown'
      childrenSignature += `  get ${c.name}(): ${type}\n`
    } else if (c.kind === typedoc.ReflectionKind.Method && c.isDeclaration()) {
      c.getAllSignatures().forEach((signature) => {
        let method = getApiMethod(c.name, signature)
        invariant(method, `Failed to get method signature: ${c.getFriendlyFullName()}`)
        childrenSignature += `  ${method.signature}\n`
      })
    } else if (c.kind === typedoc.ReflectionKind.Constructor && c.isDeclaration()) {
      c.getAllSignatures().forEach((signature) => {
        let method = getApiMethod(c.name, signature)
        invariant(method, `Failed to get constructor signature: ${c.getFriendlyFullName()}`)
        childrenSignature += `  ${method.signature}\n`
      })
    }
  })
  return childrenSignature
}

function getDocumentedInterface(
  fullName: string,
  node: typedoc.DeclarationReflection,
): DocumentedInterface {
  let { properties, accessors, methods } = getApiPropertiesAndMethods(fullName, node)

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
    aliases: node.comment ? getApiAliases(node.comment) : undefined,
    description: node.comment ? getApiDescription(node.comment) : '',
    signature,
    properties,
    accessors,
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
    aliases: node.comment ? getApiAliases(node.comment) : undefined,
    description: node.comment ? getApiDescription(node.comment) : '',
    signature,
  }
}

// Resolve the call signatures from a Variable's type, or [] if non-callable.
// Handles inline callables (`type.type === 'reflection'`) and `Object.assign`-
// style intersections by picking the first member with signatures. Reference
// types (`const x = ... as Interface`) are intentionally not chased in v1 —
// see `docs/PLAN-variable-support.md` for the follow-up.
function getVariableCallSignatures(
  node: typedoc.DeclarationReflection,
): typedoc.SignatureReflection[] {
  if (!node.type) return []

  let candidates: typedoc.SomeType[] =
    node.type.type === 'intersection' ? [...node.type.types] : [node.type]

  for (let candidate of candidates) {
    if (candidate.type === 'reflection') {
      let sigs = candidate.declaration?.signatures
      if (sigs && sigs.length > 0) return sigs
    }
  }

  return []
}

function getDocumentedVariable(
  fullName: string,
  node: typedoc.DeclarationReflection,
): DocumentedVariable {
  let name = getApiNameFromFullName(fullName)
  let keyword = node.flags.isConst ? 'const' : 'let'
  let typeStr = node.type ? node.type.toString() : 'unknown'
  let signature = `${keyword} ${name}: ${typeStr}`
  let category = getVariableCategory(node.comment)

  return {
    type: 'variable',
    path: getApiFilePath(fullName, category ?? 'variable'),
    source: node.sources?.[0]?.url,
    name,
    aliases: node.comment ? getApiAliases(node.comment) : undefined,
    description: node.comment ? getApiDescription(node.comment) : '',
    example: node.comment?.getTag('@example')?.content
      ? processApiComment(node.comment.getTag('@example')!.content)
      : undefined,
    signature,
    category,
  }
}

// Read a `@category` tag and return a recognized sidebar bucket override.
// Currently `mixin` is the only supported category; unknown values are
// ignored so the variable stays in the default "Variables" bucket.
function getVariableCategory(
  comment: typedoc.Comment | undefined,
): DocumentedVariable['category'] | undefined {
  let tag = comment?.getTag('@category')
  if (!tag) return undefined
  let value = tag.content
    .map((p) => ('text' in p ? p.text : ''))
    .join('')
    .trim()
    .toLowerCase()
  return VARIABLE_CATEGORIES.includes(value as (typeof VARIABLE_CATEGORIES)[number])
    ? (value as (typeof VARIABLE_CATEGORIES)[number])
    : undefined
}

function getDocumentedVariableFunction(
  fullName: string,
  node: typedoc.DeclarationReflection,
  signatures: typedoc.SignatureReflection[],
): DocumentedVariableFunction {
  // Prefer the variable's own JSDoc; fall back to the first signature's
  // comment (TypeDoc puts the comment on the signature for the inline
  // arrow/function-expression case).
  let comment = node.comment ?? signatures.find((s) => s.comment)?.comment

  let name = getApiNameFromFullName(fullName)
  let methods = signatures
    .map((s) => getApiMethod(fullName, s))
    .filter((m): m is Method => m != null)

  // `getApiMethod` already produces `const name: (...) => T` for TypeLiteral
  // parents. For overloads each line is shown — variables can't natively
  // express overloads, so this serves as documentation only.
  let signature = methods.map((m) => m.signature).join('\n\n')

  let parameters: ParameterOrProperty[] = []
  methods
    .flatMap((m) => m.parameters)
    .forEach((param) => {
      if (!parameters.some((p) => p.name === param.name)) {
        parameters.push(param)
      }
    })

  // Variable JSDoc often carries `@param`/`@returns` tags that TypeDoc
  // associates with the variable's comment rather than with the synthetic
  // `__type` signature's parameters. Fill in missing descriptions from the
  // variable comment so authors don't have to duplicate JSDoc onto an inner
  // arrow function expression.
  if (node.comment) {
    let paramTagsByName = new Map<string, typedoc.CommentTag>()
    for (let tag of node.comment.getTags('@param')) {
      if (tag.name) paramTagsByName.set(tag.name, tag)
    }
    if (paramTagsByName.size > 0) {
      parameters = parameters.map((p) => {
        if (p.description) return p
        let tag = paramTagsByName.get(p.name)
        return tag ? { ...p, description: processApiComment(tag.content) } : p
      })
    }
  }

  let returns = methods[0]?.returns
  if (!returns) {
    let returnsTag = node.comment?.getTag('@returns')
    if (returnsTag) returns = processApiComment(returnsTag.content)
  }

  return {
    type: 'variable-function',
    path: getApiFilePath(fullName, 'variable'),
    source: node.sources?.[0]?.url,
    name,
    aliases: comment ? getApiAliases(comment) : undefined,
    description: comment ? getApiDescription(comment) : '',
    example: comment?.getTag('@example')?.content
      ? processApiComment(comment.getTag('@example')!.content)
      : undefined,
    signature,
    parameters,
    returns,
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

function getApiFilePath(
  fullName: string,
  type: DocumentedAPI['type'] | (typeof VARIABLE_CATEGORIES)[number],
): string {
  let nameParts = fullName.split('.')
  invariant(nameParts.length >= 2, `Invalid full name for API: ${fullName}`)
  // Rewrite `@remix-run/<pkg>` to `remix/<pkg>` so docs render under the
  // umbrella's import path. The doc generator skips the actual `remix`
  // umbrella package and documents `@remix-run/*` source reflections directly
  // (see `createLookupMaps` in typedoc.ts).
  let pkg = nameParts.shift()?.replace(/^@remix-run\//g, 'remix/')
  let name = nameParts.pop()
  return [pkg, ...nameParts, type, `${name}.md`].join('/')
}

function getApiDescription(typedocComment: typedoc.Comment): string {
  return processApiComment(typedocComment.summary).trim()
}

function getApiPropertiesAndMethods(
  fullName: string,
  node: typedoc.DeclarationReflection,

  handledTypes: Set<typedoc.ReflectionKind> = new Set(),
): {
  properties: ParameterOrProperty[]
  accessors: ParameterOrProperty[]
  methods: Method[]
} {
  let properties: ParameterOrProperty[] = []
  let accessors: ParameterOrProperty[] = []
  let methods: Method[] = []
  node.traverse((child) => {
    if (child.isDeclaration()) {
      if (child.kind === typedoc.ReflectionKind.Property) {
        let property = getApiParameterOrProperty(child)
        if (property) {
          properties.push(property)
        }
      } else if (child.kind === typedoc.ReflectionKind.Accessor) {
        let accessor = getApiParameterOrProperty(child.getSignature)
        if (accessor) {
          accessors.push(accessor)
        }
      } else if (child.kind === typedoc.ReflectionKind.Method) {
        child.getAllSignatures().forEach((signature) => {
          let method = getApiMethod(fullName, signature)
          if (method) {
            methods.push(method)
          }
        })
      } else if (!handledTypes.has(child.kind)) {
        unimplemented(
          `class child kind: ${typedoc.ReflectionKind[child.kind]} ${node.getFriendlyFullName()}`,
        )
      }
    }
  })
  return { properties, accessors, methods }
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

  let returnType = node.type ? node.type.toString() : 'void'

  let typeParams = ''
  if (node.typeParameters && node.typeParameters.length > 0) {
    let typeParamStrs = node.typeParameters.map(
      (tp) => tp.name + (tp.type ? ` extends ${tp.type.toString()}` : ''),
    )
    typeParams = `<${typeParamStrs.join(', ')}>`
  }

  let signatureParams = parameters.map((p) => `${p.name}: ${p.type}`).join(', ')

  let signature: string
  if (node.parent.kind === typedoc.ReflectionKind.Function) {
    signature = `function ${node.name}${typeParams}(${signatureParams}): ${returnType}`
  } else if (node.parent.kind === typedoc.ReflectionKind.Interface) {
    signature = [
      `interface ${node.name} {`,
      `${typeParams}(${signatureParams}): ${returnType}`,
      `}`,
    ].join('\n')
  } else if (node.parent.kind === typedoc.ReflectionKind.Constructor) {
    signature = `constructor(${signatureParams}): ${returnType}`
  } else if (node.parent.kind === typedoc.ReflectionKind.Method) {
    signature = `${node.name}${typeParams}(${signatureParams}): ${returnType}`
  } else if (node.parent.kind === typedoc.ReflectionKind.TypeLiteral) {
    // Inline callable on a variable, e.g. `const f = (x: string) => x.length`.
    // The synthetic `__type` parent name isn't useful — render as a `const`
    // declaration using the variable's name from `fullName`.
    let varName = getApiNameFromFullName(fullName)
    signature = `const ${varName}: ${typeParams}(${signatureParams}) => ${returnType}`
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
          let type: DocumentedAPI['type'] | (typeof VARIABLE_CATEGORIES)[number] | null =
            target.kind === typedoc.ReflectionKind.Function ? 'function' :
            target.kind === typedoc.ReflectionKind.Class ? 'class' :
            target.kind === typedoc.ReflectionKind.TypeAlias ? 'type' :
            target.kind === typedoc.ReflectionKind.TypeLiteral ? 'type' :
            target.kind === typedoc.ReflectionKind.Interface ? 'interface' :
            target.kind === typedoc.ReflectionKind.Variable ? getVariableCategory(target.comment) || "variable" : null;

          if (!type) {
            throw new Error(`Unsupported @link target kind: ${typedoc.ReflectionKind[target.kind]}`)
          }

          let path = getApiFilePath(target.getFriendlyFullName(), type).replace(/\.md$/, '')
          href = `${WEBSITE_DOCS_PATH}/${path}/`
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
