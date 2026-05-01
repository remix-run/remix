# Add variable support to the API doc generator

## Context

The doc generator at [src/generate/](src/generate/) currently skips
TypeDoc `Variable` reflections (`ReflectionKind = 32`). The skip is gated at
[src/generate/typedoc.ts:103](src/generate/typedoc.ts#L103) with a `// TODO: Not
implemented yet` comment.

This means many high-value public APIs that are technically `export const ...`
declarations have no generated doc page even when they carry full JSDoc:

- `@remix-run/ui/button`: `baseStyle`, `iconStyle`, `labelStyle`, `primaryStyle`,
  `secondaryStyle`, `ghostStyle`, `dangerStyle` (just documented in this
  session)
- `@remix-run/test`: `it`, `describe`, `test`, `mock`, `before`, `after`,
  `suite`
- `@remix-run/html-template`: `html`
- `@remix-run/assert`: `assert`, `expect`
- `@remix-run/data-table`: `column`, `columnMetadataKey`, `tableMetadataKey`
- `@remix-run/fetch-router`: `RequestMethods`
- ~168 `Variable` reflections total across the workspace

We will add first-class `Variable` support, mirroring the existing
function/class/interface/type pipeline. Per the design decisions:

- **JSDoc required**: variables only appear in docs when they carry a JSDoc
  comment (matches function/class behavior, not interface/type).
- **New `variable/` URL segment**: doc pages live at
  `/api/<package>/<entry>/variable/<Name>/`, mirroring the existing
  `function/`, `class/`, `interface/`, `type/` segments. Sidebar gets a new
  "Variables" group.
- **Fork on callable variables**: a variable whose type resolves to a callable
  must render with `Params` / `Returns` sections, not just a flat type
  signature. We mirror the existing
  `getDocumentedInterface` / `getDocumentedInterfaceFunction` split with a
  `DocumentedVariable` / `DocumentedVariableFunction` pair, dispatched inside
  the variable builder based on what TypeDoc returns for `node.type`.

## Variable shapes we need to support

Confirmed against `build/typedoc/api.json`:

- **Inline callable** — e.g. `export const assert = ok`. TypeDoc shape:
  `node.type.type === 'reflection'`, with the `CallSignature[]` at
  `node.type.declaration.signatures`. → `DocumentedVariableFunction`. Extract
  params/returns from the signatures.
- **`Object.assign(...)`** — e.g. `export const it = Object.assign(impl, {...})`.
  TypeDoc shape: `node.type.type === 'intersection'`, where one intersection
  member is a `reflection` whose `declaration.signatures` is non-empty. →
  `DocumentedVariableFunction`. Pick the first intersection member that has
  signatures. Extras (like `it.todo`, `it.skip`) are intentionally not
  enumerated in v1 — those still surface via the static-property-on-function
  pattern that v1 doesn't try to render.
- **Type-asserted** — e.g. `export const html = helper as SafeHtmlHelper`.
  TypeDoc shape: `node.type.type === 'reference'`, target is an interface or
  type alias that owns the call signatures. → `DocumentedVariable` (plain).
  The referenced interface already has its own doc page; users follow the type
  link in the rendered signature. We do **not** chase the reference in v1.
- **Plain value** — e.g. `export const baseStyle = [...] as const`. Anything
  non-callable. → `DocumentedVariable` (plain).

The variable-function path covers the high-value `@remix-run/test`,
`@remix-run/assert`, and similar callable-`const` exports without us needing to
chase `reference` targets in v1.

## Files to change

- [src/generate/typedoc.ts](src/generate/typedoc.ts) — Add
  `ReflectionKind.Variable` to `traverseKinds`. The existing comment-required
  gate already does the right thing for variables (only `Interface`/`TypeAlias`
  are documented without a comment).
- [src/generate/documented-api.ts](src/generate/documented-api.ts) — Add
  `DocumentedVariable` and `DocumentedVariableFunction` to the `DocumentedAPI`
  union, dispatch `ReflectionKind.Variable` in `getDocumentedAPI` (forks
  internally based on whether the variable's type resolves to a callable), and
  map `Variable` to `'variable'` in the `processApiComment` `@link` resolver.
- [src/generate/markdown.ts](src/generate/markdown.ts) — Add
  `getVariableMarkdown` and `getVariableFunctionMarkdown`, dispatch both in
  `writeMarkdownFiles`. The variable-function writer mirrors
  `getInterfaceFunctionMarkdown`.
- [src/server/registry.ts](src/server/registry.ts) — Add `'variable'` to
  `ApiTypeKind` (variable-function pages still go in the same "Variables"
  sidebar group — only the URL segment differs from regular variables), plus
  entries in `TYPE_LABEL`, `TYPE_EYEBROW`, and `TYPE_ORDER`.

## Implementation details

### 1. `documented-api.ts` — new `DocumentedVariable` and `DocumentedVariableFunction` shapes

```ts
export type DocumentedVariable = BaseDocumentedAPI & {
  type: 'variable'
  signature: string
  example: string | undefined
}

export type DocumentedVariableFunction = BaseDocumentedAPI & {
  type: 'variable-function'
  signature: string
  parameters: ParameterOrProperty[]
  returns: string | undefined
  example: string | undefined
}
```

Update `BaseDocumentedAPI.type` union to include both `'variable'` and
`'variable-function'`, and add both to `DocumentedAPI`.

### 2. `documented-api.ts` — extracting call signatures from a variable

Add a helper that returns the `SignatureReflection[]` for a variable whose
type is callable, or `[]` otherwise. This is the fork's discriminator:

```ts
function getVariableCallSignatures(
  node: typedoc.DeclarationReflection,
): typedoc.SignatureReflection[] {
  let candidates: typedoc.SomeType[] = []
  if (node.type) {
    if (node.type.type === 'intersection') {
      candidates.push(...node.type.types)
    } else {
      candidates.push(node.type)
    }
  }

  for (let candidate of candidates) {
    if (candidate.type === 'reflection') {
      let sigs = candidate.declaration?.signatures
      if (sigs && sigs.length > 0) return sigs
    }
  }

  return []
}
```

Notes:

- We do **not** chase `ReferenceType` to the target interface in v1 — that is
  the `html = helper as SafeHtmlHelper` case, and the referenced interface
  already has its own doc page.
- For intersections we pick the first member with signatures. This is enough
  for the `Object.assign(impl, {...})` pattern used by `@remix-run/test`'s
  `it`, `describe`, etc.

### 3. `documented-api.ts` — `getDocumentedVariable` (plain) and `getDocumentedVariableFunction`

The plain variable builder mirrors `getDocumentedType`. Builds a TypeScript-
style `const` declaration as the signature:

```ts
function getDocumentedVariable(
  fullName: string,
  node: typedoc.DeclarationReflection,
): DocumentedVariable {
  let name = getApiNameFromFullName(fullName)
  let keyword = node.flags.isConst ? 'const' : 'let'
  let typeStr = node.type ? node.type.toString() : 'unknown'
  let signature = `${keyword} ${name}: ${typeStr}`

  return {
    type: 'variable',
    path: getApiFilePath(fullName, 'variable'),
    source: node.sources?.[0]?.url,
    name,
    aliases: node.comment ? getApiAliases(node.comment) : undefined,
    description: node.comment ? getApiDescription(node.comment) : '',
    example: node.comment?.getTag('@example')?.content
      ? processApiComment(node.comment.getTag('@example')!.content)
      : undefined,
    signature,
  }
}
```

The variable-function builder reuses the existing `getApiMethod` (the same
helper that powers `getDocumentedFunction` and `getDocumentedInterfaceFunction`)
to extract parameters and return info from the call signature(s):

```ts
function getDocumentedVariableFunction(
  fullName: string,
  node: typedoc.DeclarationReflection,
  signatures: typedoc.SignatureReflection[],
): DocumentedVariableFunction {
  // The variable's own JSDoc is the canonical comment for the page summary.
  // If it's missing, fall back to the first signature's comment (TypeDoc puts
  // the comment on the signature in the inline-callable case).
  let comment = node.comment ?? signatures.find((s) => s.comment)?.comment

  // Build a `function`-style signature line for each overload, matching the
  // shape that `getDocumentedFunction` produces for top-level functions.
  let methods = signatures
    .map((s) => getApiMethod(fullName, s))
    .filter((m): m is Method => m != null)

  let name = getApiNameFromFullName(fullName)
  // Render as `const name: (...) => ReturnType` for the plain inline-callable
  // case, falling back to the joined function signatures when there are
  // overloads. This keeps the page useful even when the variable is an
  // intersection (Object.assign), where node.type.toString() is dense.
  let signature = methods.length === 1
    ? `const ${name}: ${signatures[0].type ? methods[0].signature.replace(/^function [^(]*/, '') : 'unknown'}`
    : methods.map((m) => m.signature).join('\n\n')

  let parameters: ParameterOrProperty[] = []
  methods.flatMap((m) => m.parameters).forEach((param) => {
    if (!parameters.some((p) => p.name === param.name)) parameters.push(param)
  })

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
    returns: methods[0]?.returns,
  }
}
```

Notes:

- The page **path** still uses the `'variable'` segment for both shapes so the
  URL stays predictable (`/api/.../variable/<Name>/`). Only the internal
  `type` discriminator differs.
- Parameter descriptions come from the signature's parameter reflections,
  which TypeDoc populates from the `@param` tags whether they were written on
  the variable or on an inline arrow function.
- For the intersection case (`Object.assign(...)`), `signatures` comes from the
  first member with call signatures; the additional properties (e.g.
  `it.todo`) are not enumerated in v1.
- `defaultValue` is intentionally ignored — TypeDoc emits `"..."` for
  non-trivial values, and the type signature is more useful than a value
  snippet for the public-API surface we care about.

### 4. `documented-api.ts` — dispatch + `@link` resolution

In `getDocumentedAPI` (line 84–117), add a branch that forks internally:

```ts
} else if (node.kind === typedoc.ReflectionKind.Variable) {
  let signatures = getVariableCallSignatures(node)
  api = signatures.length > 0
    ? getDocumentedVariableFunction(fullName, node, signatures)
    : getDocumentedVariable(fullName, node)
}
```

In `processApiComment`'s reflection-target switch (line 566–571), add:

```ts
target.kind === typedoc.ReflectionKind.Variable ? 'variable' :
```

(Both `DocumentedVariable` and `DocumentedVariableFunction` resolve to the
`'variable'` URL segment, so a single mapping is correct here.)

### 5. `typedoc.ts` — enable traversal

Replace the existing TODO block at line 102–104:

```ts
let traverseKinds = new Set<typedoc.ReflectionKind>([
  typedoc.ReflectionKind.Module,
  typedoc.ReflectionKind.Function,
  typedoc.ReflectionKind.CallSignature,
  typedoc.ReflectionKind.Class,
  typedoc.ReflectionKind.Interface,
  typedoc.ReflectionKind.TypeAlias,
  typedoc.ReflectionKind.Variable,
])
```

The existing comment-required gate at line 146–149 already excludes uncommented
variables — they only get added to `apisToDocument` if `child.comment` is set,
since `Variable` is not in the always-document list.

### 6. `markdown.ts` — new `getVariableMarkdown` and `getVariableFunctionMarkdown`

Plain-variable writer modeled on `getTypeMarkdown` plus the `example` handling
that `getFunctionMarkdown` uses:

````ts
async function getVariableMarkdown(comment: DocumentedVariable): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    comment.description ? summary(comment) : null,
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
    comment.example
      ? h2(
          'Example',
          comment.example.trim().startsWith('```') ? comment.example : await pre(comment.example),
        )
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}
````

Variable-function writer mirrors `getInterfaceFunctionMarkdown` — it adds the
`Params` and `Returns` sections that the plain version omits:

````ts
async function getVariableFunctionMarkdown(
  comment: DocumentedVariableFunction,
): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    comment.description ? summary(comment) : null,
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
          comment.parameters
            .map((param) => h3(`\`${param.name}\``, param.description))
            .join('\n\n'),
        )
      : undefined,
    comment.returns ? h2('Returns', comment.returns) : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}
````

Wire both into the dispatch at line 19–29:

```ts
} else if (comment.type === 'variable') {
  await fs.writeFile(mdPath, await getVariableMarkdown(comment))
} else if (comment.type === 'variable-function') {
  await fs.writeFile(mdPath, await getVariableFunctionMarkdown(comment))
}
```

Import `DocumentedVariable` and `DocumentedVariableFunction` at the top of
the file.

### 7. `server/registry.ts` — sidebar group

Update [src/server/registry.ts:6-22](src/server/registry.ts#L6-L22):

```ts
export type ApiTypeKind = 'type' | 'interface' | 'class' | 'function' | 'variable'

const TYPE_LABEL: Record<ApiTypeKind, string> = {
  type: 'Types',
  interface: 'Interfaces',
  class: 'Classes',
  function: 'Functions',
  variable: 'Variables',
}

const TYPE_EYEBROW: Record<ApiTypeKind, string> = {
  type: 'Type',
  interface: 'Interface',
  class: 'Class',
  function: 'Function',
  variable: 'Variable',
}

const TYPE_ORDER: ApiTypeKind[] = ['type', 'interface', 'class', 'function', 'variable']
```

Sidebar order places "Variables" last — they tend to be lower-traffic than
functions/classes/types. (Adjust the position in `TYPE_ORDER` if this isn't the
desired UX.)

### Why no changes to `server/markdown.ts`

The website's [discoverMarkdownFiles](src/server/markdown.ts#L24) derives
`type` from the second-to-last path segment, so adding files under
`variable/<Name>.md` Just Works without changes there.

## Verification

1. **Regenerate docs** from the `docs/` directory:

   ```sh
   cd docs && pnpm run generate
   ```

   (or whatever script wraps `src/generate/index.ts` — check
   `package.json`).

2. **Confirm new pages exist** for the button styles documented earlier:

   ```sh
   ls build/md/remix/ui/button/variable/
   # expect: baseStyle.md  iconStyle.md  labelStyle.md
   #         primaryStyle.md  secondaryStyle.md  ghostStyle.md  dangerStyle.md
   ls build/md/remix/ui/button/function/
   # expect: Button.md (now generated thanks to the JSDoc added earlier)
   ```

3. **Spot-check a plain variable** (`baseStyle.md`): frontmatter present with
   `source`, summary section reflects JSDoc, signature renders as
   `const baseStyle: readonly [...]`. No `Params` / `Returns` sections.

4. **Spot-check a callable variable** (`build/md/remix/test/variable/it.md`
   and `build/md/remix/assert/variable/assert.md`): page emits a `Params`
   section with one entry per signature parameter (descriptions sourced from
   the `@param` tags), and a `Returns` section when the JSDoc has `@returns`.
   The signature shown is callable-style (`const it: (name, fn) => void` or
   the joined overload signatures), not the dense intersection
   `node.type.toString()`.

5. **Spot-check the type-asserted case** (`build/md/remix/html-template/variable/html.md`):
   page renders as a plain variable with the variable's JSDoc summary and a
   `const html: SafeHtmlHelper` signature. The signature should hyperlink to
   the `SafeHtmlHelper` interface page (existing `{@link}` behavior on
   identifiers in code blocks).

6. **Lint + typecheck**:

   ```sh
   pnpm --filter @remix-run/docs run lint
   pnpm --filter @remix-run/docs run typecheck
   ```

7. **Smoke-test the website** by serving the docs locally and confirming the
   sidebar shows a "Variables" group for `@remix-run/ui/button`, with the
   pages rendering correctly and `{@link}` cross-references working.

## Known gaps to follow up on

These cases are intentionally out of scope for v1. Capture as follow-up issues
once v1 lands and we have real coverage data on what's actually missing.

### 1. Type-asserted callables don't render Params/Returns

Variables with a `reference` type that points at a callable interface — the
`html = helper as SafeHtmlHelper` shape — currently render as a plain
`DocumentedVariable`. The user sees the variable's summary and a
`const html: SafeHtmlHelper` line, but no `Params` or `Returns` section, even
though the call signatures live on the referenced interface and the user
likely expects to consume `html` directly.

**Follow-up**: extend `getVariableCallSignatures` to follow `ReferenceType`
targets, resolve to the interface's call signatures, and dispatch to
`getDocumentedVariableFunction`. Watch out for cycles and for references
pointing to non-callable types (where it should still fall back to plain
variable).

### 2. `Object.assign(...)` extras are not enumerated

For patterns like `const it = Object.assign(itImpl, { todo, skip, only })`,
v1 picks up the call signatures from the first intersection member and
ignores the property bag. The result is that `it.todo`, `it.skip`, `it.only`
do not appear on the `it` page even though they are part of the public API
surface.

**Follow-up**: walk the remaining intersection members for `reflection`
declarations whose children are properties/methods, and emit a "Properties"
or "Methods" section on the variable-function page. The class-page renderer
already does the heavy lifting for this in `getApiPropertiesAndMethods` —
likely reusable.

### 3. Generic type parameters on variable-functions

`const f = <T>(x: T) => x` produces a `Variable` whose nested `CallSignature`
has `typeParameters`. The existing `getApiMethod` helper threads
`typeParameters` into the signature string, but we have not verified the
rendered output looks clean for the common variable patterns. Worth a smoke
test once v1 is generating pages and the next time we touch a generic
inline-callable export.

### 4. `defaultValue` is dropped for trivial constants

Variables like `const REMIX_VERSION = '0.1.0'` or `const DEFAULT_TIMEOUT = 5000`
get a type-only signature in v1 (`const REMIX_VERSION: string`), which loses
the value. TypeDoc surfaces these as a real string in `defaultValue` (not the
`"..."` sentinel it uses for complex objects).

**Follow-up**: when `defaultValue` is a short literal (string, number,
boolean), append it to the rendered signature. Skip when `defaultValue` is
`"..."` or omitted.

### 5. Plain re-export aliases without an `@alias` tag

`export const assert = ok` produces two doc pages — one for `ok` (function)
and one for `assert` (variable-function), both with the same call signatures.
The existing `@alias` JSDoc tag deduplicates this when authors opt in
(`getAliasedAPIs` in `typedoc.ts`), but a plain re-export without the tag
will double up. This is the same issue today's function pipeline has, just
now with more surface area.

**Follow-up**: detect identity-typed variable re-exports and either treat
them implicitly as aliases of their target, or warn so authors know to add
`@alias`.
