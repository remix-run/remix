import type {
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  Transform
} from "jscodeshift";

import type { PackageName} from "./packagesExports";
import { packagesExports } from "./packagesExports";
import { sortBy } from "./sortBy";

export const parser = "tsx";

type Specifier = ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier
const isNamedImportsSpecifier = (
  specifier: Specifier
) => specifier.type === 'ImportSpecifier'
const isDefaultSpecifier = (
  specifier: Specifier
) => specifier.type === 'ImportDefaultSpecifier'
const isNamespaceSpecifier = (
  specifier: Specifier
) => specifier.type === 'ImportNamespaceSpecifier'

interface NamedImportIdentifier {
  name: string,
  alias: string,
}

interface Options {
  serverRuntime?: PackageName,
  serverAdapter?: PackageName,
}

const transform: Transform = (file, api, options: Options) => {
  let j = api.jscodeshift
  let root = j(file.source)

  // Retain comment on first line
  // https://github.com/facebook/jscodeshift/blob/main/recipes/retain-first-comment.md
  let getFirstNode = () => root.find(j.Program).get('body', 0).node
  let firstNode = getFirstNode()
  let { comments } = firstNode

  // Find all `remix` imports
  let remixImports = root
    .find(j.ImportDeclaration)
    .filter(path => path.value.source.value === 'remix')
  
  // no-op if there are no `remix` imports
  if (remixImports.length === 0) return null

  // Do not handle `remix` side-effect imports 
  let remixSideEffectImports = remixImports
    .filter(path => path.value.specifiers?.length === 0)
  if (remixSideEffectImports.length !== 0) {
    throw Error('There should not be any side-effect imports for `remix`. Please remove the side-effect import and try again.')
  }
  
  // Do not handle `remix` default imports
  let remixDefaultImports = remixImports
    .filter(path => path.value.specifiers?.some(isDefaultSpecifier) ?? false)
  if (remixDefaultImports.length !== 0) {
    throw Error('There should not be any default imports for `remix`. Please replace the default import with named imports and try again.')
  }

  // Do not handle `remix` namespace imports
  let remixNamespaceImports = remixImports
    .filter(path => path.value.specifiers?.some(isNamespaceSpecifier) ?? false)
  if (remixNamespaceImports.length !== 0) {
    throw Error('There should not be any namespace imports for `remix`. Please replace the namespace import with named imports and try again.')
  }

  // All remaining `remix` imports should be named imports
  let remixNamedImports = remixImports
    .filter(path => path.value.specifiers?.every(isNamedImportsSpecifier) ?? false)
  
  // Determine name and alias for each imported value or type
  let remixValueImports: NamedImportIdentifier[] = []
  let remixTypeImports: NamedImportIdentifier[] = [] 
  remixNamedImports.forEach(path => {
    let kind = path.value.importKind
    if (path.value.specifiers === undefined) return
    path.value.specifiers.forEach(specifier => {
      if (specifier.type !== 'ImportSpecifier') return
      let name = specifier.imported.name
      let alias = specifier.local?.name ?? name
      if (kind === "value") {
        remixValueImports.push({ name, alias })
      }
      if (kind === "type") {
        remixTypeImports.push({ name, alias })
      }
    })
  })

  // Remember where first `remix` import is so we can write the new imports there
  let ANCHOR = j(remixImports.paths()[0])

  let writeImportDeclarations = (packageName: PackageName): void => {
    // Filter `remix` imports to those that match exports from the specified package
    let matchPackageExports = (kind: "value" | "type") => ({ name }: NamedImportIdentifier) =>
      packagesExports[packageName][kind].includes(name)
    let matchingImports = {
      value: remixValueImports.filter(matchPackageExports("value")),
      type: remixTypeImports.filter(matchPackageExports("type")),
    }

    // Convert matched imports to import declarations
    let sortByName = sortBy(({ name }: NamedImportIdentifier) => name)
    let toImportDeclaration = (imports: NamedImportIdentifier[], kind: "value" | "type"): ImportDeclaration => {
      return j.importDeclaration(
        imports
          .sort(sortByName)
          .map(({ name, alias}) => j.importSpecifier(j.identifier(name), j.identifier(alias))),
        j.literal(packageName),
        kind,
      )
    }

    // Write value import declaration
    if (matchingImports.value.length > 0) {
      ANCHOR.insertBefore(toImportDeclaration(matchingImports.value, "value"))
    }
    // Write type import declaration
    if (matchingImports.type.length > 0) {
      ANCHOR.insertBefore(toImportDeclaration(matchingImports.type, "type"))
    }
  }

  // Client framework imports
  writeImportDeclarations("@remix-run/react")

  let { serverRuntime, serverAdapter } = options
  // Server runtime imports
  if (serverRuntime) writeImportDeclarations(serverRuntime)
  // Adapter imports
  if (serverAdapter) writeImportDeclarations(serverAdapter)

  // Remove `remix` imports
  remixImports.forEach(path => j(path).remove())

  // If the first node has been modified or deleted, reattach the comments
  let firstNode2 = getFirstNode()
  if (firstNode2 !== firstNode) {
    firstNode2.comments = comments
  }

  return root.toSource()
}

export default transform