/**
 * HMR Transform
 *
 * This transform converts Remix components to support HMR by:
 * 1. Hoisting setup variables to a stable state object
 * 2. Generating a hash of the setup code to detect changes
 * 3. Creating a delegating wrapper pattern for hot-swapping
 *
 * Runs on JS (post-esbuild), not TypeScript source.
 * Detects components via: PascalCase function that returns a function expression.
 *
 * Uses SWC's AST transformation and codegen for proper source map support.
 */

import swc from '@swc/core'
import type {
  Module,
  ModuleItem,
  FunctionDeclaration,
  FunctionExpression,
  VariableDeclaration,
  ReturnStatement,
  ArrowFunctionExpression,
  Expression,
  Statement,
  BlockStatement,
  Identifier,
  Pattern,
  ExpressionStatement,
  CallExpression,
  Argument,
  StringLiteral,
  Span,
  MemberExpression,
  ObjectPattern,
  ObjectExpression,
  ImportDeclaration,
} from '@swc/types'

// Unified component info extracted from any function form
interface ComponentInfo {
  name: string
  params: Pattern[] // Setup function parameters (e.g., handle)
  body: BlockStatement
  renderBody: Expression
  renderParams: Pattern[] // Render function parameters (e.g., props)
  renderIsArrow: boolean // Whether the render function is an arrow function
  span: Span
}

// The HMR runtime module path.
// This is served by the middleware at this URL.
// Uses __@remix namespace for internal middleware URLs.
export const HMR_RUNTIME_PATH = '/__@remix/hmr-runtime.ts'

// HMR functions imported from the runtime module
const HMR_IMPORTS = [
  '__hmr_state',
  '__hmr_setup',
  '__hmr_register',
  '__hmr_call',
  '__hmr_request_remount',
  '__hmr_register_component',
  '__hmr_get_component',
]

export interface TransformResult {
  code: string
  map?: string
}

// Simple hash function for the setup code
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return 'h' + Math.abs(hash).toString(36)
}

// Check if a name is PascalCase (starts with uppercase)
function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name)
}

// Dummy context value for synthetic nodes.
// SWC uses ctxt for hygiene/scoping. 0 is safe for synthetic nodes.
let DUMMY_CTXT = 0

// Create a synthetic span (for generated code)
function syntheticSpan(): Span {
  return { start: 0, end: 0, ctxt: DUMMY_CTXT }
}

// Create an identifier AST node
function createIdentifier(name: string, span: Span = syntheticSpan()): Identifier {
  return {
    type: 'Identifier',
    span: { start: span.start, end: span.end, ctxt: span.ctxt },
    ctxt: DUMMY_CTXT,
    value: name,
    optional: false,
  } as Identifier
}

// Convert a Pattern to an Expression (for passing params through function calls)
function patternToExpression(pattern: Pattern): Expression {
  if (pattern.type === 'Identifier') {
    return pattern as any as Expression
  }
  // For ObjectPattern and other complex patterns, reconstruct as object expression
  if (pattern.type === 'ObjectPattern') {
    return {
      type: 'ObjectExpression',
      span: pattern.span,
      properties: pattern.properties.map((prop: any) => {
        if (prop.type === 'KeyValuePatternProperty') {
          return {
            type: 'KeyValueProperty',
            key: prop.key,
            value: prop.key, // Use key as value (shorthand-like reconstruction)
          }
        }
        return prop
      }),
    } as any
  }
  // Fallback: return as-is and hope it works
  return pattern as any
}

// Create a string literal AST node
function createStringLiteral(value: string): StringLiteral {
  return {
    type: 'StringLiteral',
    span: syntheticSpan(),
    value,
    raw: `'${value}'`,
  }
}

// Create a call expression AST node
function createCallExpression(callee: string, args: Expression[]): CallExpression {
  return {
    type: 'CallExpression',
    span: syntheticSpan(),
    ctxt: DUMMY_CTXT,
    callee: createIdentifier(callee),
    arguments: args.map(
      (expression): Argument => ({
        spread: undefined,
        expression,
      }),
    ),
  } as CallExpression
}

// Create an expression statement
function createExpressionStatement(expression: Expression): ExpressionStatement {
  return {
    type: 'ExpressionStatement',
    span: syntheticSpan(),
    expression,
  }
}

// Create a variable declaration: let name = init
function createLetDeclaration(name: string, init: Expression): VariableDeclaration {
  return {
    type: 'VariableDeclaration',
    span: syntheticSpan(),
    ctxt: DUMMY_CTXT,
    kind: 'let',
    declare: false,
    declarations: [
      {
        type: 'VariableDeclarator',
        span: syntheticSpan(),
        id: createIdentifier(name),
        init,
        definite: false,
      },
    ],
  } as VariableDeclaration
}

// Create a member expression: object.property
function createMemberExpression(object: string, property: string): MemberExpression {
  return {
    type: 'MemberExpression',
    span: syntheticSpan(),
    object: createIdentifier(object),
    property: {
      type: 'Identifier',
      span: syntheticSpan(),
      value: property,
    },
  } as MemberExpression
}

// Create an arrow function expression
function createArrowFunction(
  body: Expression | BlockStatement,
  params: Pattern[] = [],
): ArrowFunctionExpression {
  return {
    type: 'ArrowFunctionExpression',
    span: syntheticSpan(),
    ctxt: DUMMY_CTXT,
    params,
    body,
    async: false,
    generator: false,
  } as ArrowFunctionExpression
}

// Create a function expression
function createFunctionExpression(
  body: BlockStatement,
  params: Pattern[] = [],
): FunctionExpression {
  return {
    type: 'FunctionExpression',
    span: syntheticSpan(),
    ctxt: DUMMY_CTXT,
    params: params.map((p: any) => ({
      type: 'Parameter',
      span: syntheticSpan(),
      pat: p,
      decorators: [],
    })),
    decorators: [],
    body,
    async: false,
    generator: false,
  } as any as FunctionExpression
}

// Create a return statement
function createReturnStatement(argument: Expression): ReturnStatement {
  return {
    type: 'ReturnStatement',
    span: syntheticSpan(),
    argument,
  }
}

// Create a block statement
function createBlockStatement(stmts: Statement[]): BlockStatement {
  return {
    type: 'BlockStatement',
    span: syntheticSpan(),
    ctxt: DUMMY_CTXT,
    stmts,
  } as BlockStatement
}

// Convert an ObjectPattern (like { signal, params }) to an ObjectExpression.
// This is needed when we want to pass destructured params to HMR functions.
function convertObjectPatternToExpression(pattern: ObjectPattern): ObjectExpression {
  let properties = pattern.properties.map((prop: any) => {
    if (prop.type === 'AssignmentPatternProperty') {
      // { signal } becomes { signal: signal } - use shorthand property
      return {
        type: 'KeyValueProperty' as const,
        key: createIdentifier(prop.key.value),
        value: createIdentifier(prop.key.value),
      }
    } else if (prop.type === 'KeyValuePatternProperty') {
      // { signal: s } - use the key as shorthand
      if (prop.key.type === 'Identifier') {
        return {
          type: 'KeyValueProperty' as const,
          key: createIdentifier(prop.key.value),
          value: createIdentifier(prop.key.value),
        }
      }
    }
    // Fallback - shouldn't happen for typical patterns
    return {
      type: 'KeyValueProperty' as const,
      key: createIdentifier('unknown'),
      value: createIdentifier('unknown'),
    }
  })

  return {
    type: 'ObjectExpression',
    span: syntheticSpan(),
    properties,
  } as ObjectExpression
}

// Create a function declaration
function createFunctionDeclaration(
  name: string,
  params: Pattern[],
  body: BlockStatement,
  span: Span = syntheticSpan(),
): FunctionDeclaration {
  return {
    type: 'FunctionDeclaration',
    identifier: createIdentifier(name, span),
    declare: false,
    params: params.map((pat) => ({
      type: 'Parameter',
      span: syntheticSpan(),
      pat,
      decorators: [],
    })),
    body,
    generator: false,
    async: false,
    span: { start: span.start, end: span.end, ctxt: span.ctxt },
    ctxt: DUMMY_CTXT,
  } as FunctionDeclaration
}

// Extract component info from a function declaration
// Pattern: function Counter(handle) { ... return () => ... }
function extractComponentFromFunctionDecl(func: FunctionDeclaration): ComponentInfo | null {
  if (!func.identifier || !isPascalCase(func.identifier.value)) return null
  if (!func.body) return null

  let renderInfo = extractRenderBodyFromBlock(func.body)
  if (!renderInfo) return null

  return {
    name: func.identifier.value,
    params: func.params.map((p: any) => p.pat),
    body: func.body,
    renderBody: renderInfo.body,
    renderParams: renderInfo.params,
    renderIsArrow: renderInfo.isArrow,
    span: func.span,
  }
}

// Extract component info from a variable declaration
// Patterns:
//   const Counter = function(handle) { ... return () => ... }
//   const Counter = (handle) => { ... return () => ... }
//   const Counter = (handle) => () => ...
function extractComponentFromVarDecl(decl: VariableDeclaration): ComponentInfo | null {
  // Only handle single declarator
  if (decl.declarations.length !== 1) return null

  let declarator = decl.declarations[0]
  if (declarator.id.type !== 'Identifier') return null
  if (!isPascalCase(declarator.id.value)) return null
  if (!declarator.init) return null

  let init = declarator.init
  let name = declarator.id.value
  let span = declarator.span

  // Handle FunctionExpression: const Counter = function(handle) { ... }
  if (init.type === 'FunctionExpression') {
    let funcExpr = init as FunctionExpression
    if (!funcExpr.body) return null

    let renderInfo = extractRenderBodyFromBlock(funcExpr.body)
    if (!renderInfo) return null

    return {
      name,
      params: funcExpr.params.map((p: any) => p.pat),
      body: funcExpr.body,
      renderBody: renderInfo.body,
      renderParams: renderInfo.params,
      renderIsArrow: renderInfo.isArrow,
      span,
    }
  }

  // Handle ArrowFunctionExpression
  if (init.type === 'ArrowFunctionExpression') {
    let arrowExpr = init as ArrowFunctionExpression

    // Arrow with block body: const Counter = (handle) => { ... return () => ... }
    if (arrowExpr.body.type === 'BlockStatement') {
      let body = arrowExpr.body as BlockStatement
      let renderInfo = extractRenderBodyFromBlock(body)
      if (!renderInfo) return null

      return {
        name,
        params: arrowExpr.params,
        body,
        renderBody: renderInfo.body,
        renderParams: renderInfo.params,
        renderIsArrow: renderInfo.isArrow,
        span,
      }
    }

    // Arrow with expression body: const Counter = (handle) => () => ...
    // The expression body IS the render function
    let exprBody = arrowExpr.body as Expression
    if (exprBody.type === 'ArrowFunctionExpression' || exprBody.type === 'FunctionExpression') {
      let innerFunc = exprBody as ArrowFunctionExpression | FunctionExpression

      // Extract the render body and params from the inner function
      let renderBody: Expression | null = null
      let renderParams: Pattern[] = []
      let renderIsArrow = innerFunc.type === 'ArrowFunctionExpression'

      if (innerFunc.type === 'ArrowFunctionExpression') {
        renderBody = innerFunc.body as Expression
        renderParams = innerFunc.params
      } else if (innerFunc.body) {
        let innerReturn = innerFunc.body.stmts.find(
          (s: any): s is ReturnStatement => s.type === 'ReturnStatement',
        )
        if (innerReturn?.argument) {
          renderBody = innerReturn.argument
          renderParams = innerFunc.params.map((p: any) => p.pat)
        }
      }

      if (!renderBody) return null

      // For expression-body arrows, there's no block statement with setup vars
      // Create an empty synthetic body
      return {
        name,
        params: arrowExpr.params,
        body: createBlockStatement([]),
        renderBody,
        renderParams,
        renderIsArrow,
        span,
      }
    }
  }

  return null
}

// Extract render function info from a block statement (finds return statement)
function extractRenderBodyFromBlock(
  body: BlockStatement,
): { body: Expression; params: Pattern[]; isArrow: boolean } | null {
  let returnStmt = body.stmts.find((s: any): s is ReturnStatement => s.type === 'ReturnStatement')
  if (!returnStmt || !returnStmt.argument) return null

  let returnedFunc = returnStmt.argument
  if (
    returnedFunc.type !== 'ArrowFunctionExpression' &&
    returnedFunc.type !== 'FunctionExpression'
  ) {
    return null
  }

  if (returnedFunc.type === 'ArrowFunctionExpression') {
    let arrowFunc = returnedFunc as ArrowFunctionExpression
    return {
      body: arrowFunc.body as Expression,
      params: arrowFunc.params,
      isArrow: true,
    }
  }

  // FunctionExpression - find return statement in its body
  let funcExpr = returnedFunc as FunctionExpression
  let innerReturn = funcExpr.body?.stmts.find(
    (s: any): s is ReturnStatement => s.type === 'ReturnStatement',
  )
  if (!innerReturn?.argument) return null
  return {
    body: innerReturn.argument,
    params: funcExpr.params.map((p: any) => p.pat),
    isArrow: false,
  }
}

interface SetupVar {
  name: string
  init: Expression
}

// Extract setup variables (let declarations) from a function body
function extractSetupVars(body: BlockStatement): SetupVar[] {
  let setupVars: SetupVar[] = []

  for (let stmt of body.stmts) {
    if (stmt.type === 'VariableDeclaration' && stmt.kind === 'let') {
      for (let d of stmt.declarations) {
        if (d.id.type === 'Identifier' && d.init) {
          setupVars.push({
            name: d.id.value,
            init: d.init,
          })
        }
      }
    }
  }

  return setupVars
}

// Compute a hash string for setup variables (for change detection)
function computeSetupHash(setupVars: SetupVar[], source: string, baseOffset: number): string {
  // Create a string representation of setup code for hashing
  let setupParts = setupVars.map((v) => {
    // All expressions from variable declarations have spans
    let initSpan = (v.init as { span: Span }).span
    let initStart = initSpan.start - baseOffset
    let initEnd = initSpan.end - baseOffset
    return `${v.name} = ${source.slice(initStart, initEnd)}`
  })
  return simpleHash(setupParts.join('\n').replace(/\s+/g, ' '))
}

// Deep clone and transform an expression, replacing identifier references
// with __s.identifier for setup variables.
function transformExpression(expr: Expression, setupVarNames: Set<string>): Expression {
  // Helper to recursively transform
  function transform<T>(node: T): T {
    if (node === null || node === undefined) return node
    if (typeof node !== 'object') return node

    // Handle arrays
    if (Array.isArray(node)) {
      return node.map(transform) as T
    }

    // Cast to any for property access
    let obj = node as Record<string, unknown>

    // Check if this is an identifier that should be transformed
    if (obj.type === 'Identifier' && typeof obj.value === 'string') {
      let id = obj as unknown as Identifier
      if (setupVarNames.has(id.value)) {
        // Replace with __s.identifier (member expression)
        return createMemberExpression('__s', id.value) as unknown as T
      }
    }

    // Don't transform identifiers that are property names in member expressions
    if (obj.type === 'MemberExpression') {
      let memberExpr = obj as unknown as MemberExpression
      return {
        ...memberExpr,
        object: transform(memberExpr.object as Expression),
        // Only transform computed properties, not identifier properties
        property:
          memberExpr.property.type === 'Computed'
            ? transform(memberExpr.property)
            : memberExpr.property,
      } as unknown as T
    }

    // Recursively transform object properties
    let result: Record<string, unknown> = {}
    for (let key of Object.keys(obj)) {
      result[key] = transform(obj[key])
    }
    return result as T
  }

  return transform(expr)
}

// Generate the transformed module items for a component
function generateHmrComponent(
  component: ComponentInfo,
  moduleUrl: string,
  setupVars: SetupVar[],
  setupHash: string,
  isExported: boolean,
): ModuleItem[] {
  let { name, params, renderBody, span } = component
  let implName = `${name}__impl`

  // Get the parameter pattern from the original function
  let paramPattern: Pattern = params.length > 0 ? params[0] : createIdentifier('handle')

  // Create a reference to the parameter (for passing to HMR functions)
  // If it's a destructuring pattern, we need to convert to an object expression
  let paramRef: Expression
  if (paramPattern.type === 'Identifier') {
    paramRef = createIdentifier(paramPattern.value)
  } else if (paramPattern.type === 'ObjectPattern') {
    // Convert ObjectPattern { signal, params } to ObjectExpression { signal, params }
    paramRef = convertObjectPatternToExpression(paramPattern)
  } else {
    // Fallback for array patterns or other cases
    paramRef = createIdentifier('handle')
  }

  // Transform render body to use __s.varName for setup vars
  let varNames = new Set(setupVars.map((v) => v.name))
  let transformedRenderBody = transformExpression(renderBody, varNames)

  // Build setup function body: __s.varName = initExpr
  let setupStatements: Statement[] = setupVars.map((v) =>
    createExpressionStatement({
      type: 'AssignmentExpression',
      span: syntheticSpan(),
      operator: '=',
      left: createMemberExpression('__s', v.name),
      right: v.init,
    }),
  )

  // Create the setup arrow function with a block body
  let setupFn = createArrowFunction(createBlockStatement(setupStatements))

  // Build __impl function body
  let implBody: Statement[] = [
    // let __s = __hmr_state(param)
    createLetDeclaration('__s', createCallExpression('__hmr_state', [paramRef])),

    // if (__hmr_setup(param, hash, setupFn)) { __hmr_request_remount(param); return () => null }
    {
      type: 'IfStatement',
      span: syntheticSpan(),
      test: createCallExpression('__hmr_setup', [
        paramRef,
        createStringLiteral(setupHash),
        setupFn,
      ]),
      consequent: createBlockStatement([
        createExpressionStatement(createCallExpression('__hmr_request_remount', [paramRef])),
        createReturnStatement(createArrowFunction({ type: 'NullLiteral', span: syntheticSpan() })),
      ]),
    },

    // __hmr_register(moduleUrl, name, param, (renderParams...) => renderBody)
    // Preserve the original function style (arrow vs regular)
    createExpressionStatement(
      createCallExpression('__hmr_register', [
        createStringLiteral(moduleUrl),
        createStringLiteral(name),
        paramRef,
        component.renderIsArrow
          ? createArrowFunction(transformedRenderBody, component.renderParams)
          : createFunctionExpression(
              createBlockStatement([createReturnStatement(transformedRenderBody)]),
              component.renderParams,
            ),
      ]),
    ),

    // return (renderParams...) => __hmr_call(param, renderParams...)
    // Preserve the original function style (arrow vs regular)
    createReturnStatement(
      component.renderIsArrow
        ? createArrowFunction(
            createCallExpression('__hmr_call', [
              paramRef,
              ...component.renderParams.map((param) => patternToExpression(param)),
            ]),
            component.renderParams,
          )
        : createFunctionExpression(
            createBlockStatement([
              createReturnStatement(
                createCallExpression('__hmr_call', [
                  paramRef,
                  ...component.renderParams.map((param) => patternToExpression(param)),
                ]),
              ),
            ]),
            component.renderParams,
          ),
    ),
  ]

  // Create __impl function
  let implFunc = createFunctionDeclaration(implName, [paramPattern], createBlockStatement(implBody))

  // Create __hmr_register_component call
  let registerCall = createExpressionStatement(
    createCallExpression('__hmr_register_component', [
      createStringLiteral(moduleUrl),
      createStringLiteral(name),
      createIdentifier(implName),
    ]),
  )

  // Create the wrapper function
  let wrapperBody: Statement[] = [
    createLetDeclaration(
      'impl',
      createCallExpression('__hmr_get_component', [
        createStringLiteral(moduleUrl),
        createStringLiteral(name),
      ]),
    ),
    createReturnStatement(createCallExpression('impl', [paramRef])),
  ]

  let wrapperFunc = createFunctionDeclaration(
    name,
    [paramPattern],
    createBlockStatement(wrapperBody),
    span, // Preserve original span for source mapping
  )

  // Build the module items
  let items: ModuleItem[] = [implFunc, registerCall]

  if (isExported) {
    items.push({
      type: 'ExportDeclaration',
      span: syntheticSpan(),
      declaration: wrapperFunc,
    })
  } else {
    items.push(wrapperFunc)
  }

  return items
}

// Create an import declaration for HMR runtime functions
function createHmrImport(): ImportDeclaration {
  return {
    type: 'ImportDeclaration',
    span: syntheticSpan(),
    specifiers: HMR_IMPORTS.map((name) => ({
      type: 'ImportSpecifier' as const,
      span: syntheticSpan(),
      local: createIdentifier(name),
      imported: undefined, // same as local
      isTypeOnly: false,
    })),
    source: createStringLiteral(HMR_RUNTIME_PATH),
    typeOnly: false,
    with: undefined,
  } as ImportDeclaration
}

// Extract inline source map from source code
function extractInlineSourceMap(source: string): string | undefined {
  let match = source.match(/\/\/# sourceMappingURL=data:application\/json;base64,([^\s]+)/)
  if (match) {
    try {
      return Buffer.from(match[1], 'base64').toString('utf-8')
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Transform component source for HMR.
 * Expects JS input (post-esbuild transform).
 *
 * @param source The source code to transform
 * @param moduleUrl The module URL for HMR registration
 * @returns The transformed code and optional source map
 */
export async function transformComponent(
  source: string,
  moduleUrl: string,
): Promise<TransformResult> {
  // Quick check for potential components
  if (!maybeHasComponent(source)) {
    return { code: source }
  }

  // Parse as JS with JSX enabled (handles both esbuild output and test inputs)
  let ast: Module
  try {
    ast = (await swc.parse(source, {
      syntax: 'ecmascript',
      jsx: true,
    })) as Module
  } catch {
    return { code: source }
  }

  if (ast.type !== 'Module') {
    return { code: source }
  }

  // Calculate base offset for span adjustment
  let firstNonWhitespace = source.search(/\S/)
  if (firstNonWhitespace === -1) firstNonWhitespace = 0
  let baseOffset = ast.span.start - firstNonWhitespace

  // Transform module items
  let newBody: ModuleItem[] = []
  let hasTransformations = false

  for (let item of ast.body) {
    let transformed = false

    // Try to extract component from various patterns
    let component: ComponentInfo | null = null
    let isExported = false

    if (item.type === 'ExportDeclaration') {
      isExported = true
      let decl = item.declaration

      if (decl.type === 'FunctionDeclaration') {
        component = extractComponentFromFunctionDecl(decl)
      } else if (decl.type === 'VariableDeclaration') {
        component = extractComponentFromVarDecl(decl)
      }
    } else if (item.type === 'FunctionDeclaration') {
      component = extractComponentFromFunctionDecl(item)
    } else if ((item as any).type === 'VariableDeclaration') {
      component = extractComponentFromVarDecl(item as any)
    }

    // If we found a component, transform it
    if (component) {
      let setupVars = extractSetupVars(component.body)
      let setupHash = computeSetupHash(setupVars, source, baseOffset)
      let hmrItems = generateHmrComponent(component, moduleUrl, setupVars, setupHash, isExported)
      newBody.push(...hmrItems)
      transformed = true
      hasTransformations = true
    }

    if (!transformed) {
      newBody.push(item)
    }
  }

  if (!hasTransformations) {
    return { code: source }
  }

  // Add HMR runtime import at the beginning
  let hmrImport = createHmrImport()

  // Create transformed AST with import prepended
  let transformedAst: Module = {
    ...ast,
    body: [hmrImport, ...newBody],
  }

  // Extract input source map if present (from esbuild inline maps)
  let inputSourceMap = extractInlineSourceMap(source)

  // Print the transformed AST with source map support
  try {
    let result = await swc.print(transformedAst, {
      sourceMaps: true,
      inputSourceMap,
      jsc: {
        target: 'es2022',
      },
    })

    return {
      code: result.code,
      map: result.map,
    }
  } catch (error) {
    // If print fails, fall back to returning unchanged source
    console.error('HMR transform print failed:', error)
    return { code: source }
  }
}

/**
 * Quick smoke check if source might contain a component.
 * Just checks for PascalCase declarations - the real detection happens in AST parsing.
 *
 * @param source The source code to check
 * @returns True if source may contain a component
 */
export function maybeHasComponent(source: string): boolean {
  // function Foo, const Foo =, let Foo =, export function Foo, export const Foo =
  return /\b(?:function\s+[A-Z]|(?:const|let)\s+[A-Z][a-zA-Z0-9]*\s*=)/.test(source)
}
