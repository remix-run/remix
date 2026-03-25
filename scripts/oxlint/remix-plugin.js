let pascalCasePattern = /^[A-Z][A-Za-z0-9]*$/

let interfacePascalCaseRule = {
  meta: {
    type: 'suggestion',
  },
  create(context) {
    return {
      TSInterfaceDeclaration(node) {
        if (pascalCasePattern.test(node.id.name)) {
          return
        }

        context.report({
          node: node.id,
          message: 'Interface names must use PascalCase.',
        })
      },
    }
  },
}

let preferLetLocalsRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
  },
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind !== 'const') {
          return
        }

        let parent = node.parent
        let isModuleScope =
          parent?.type === 'Program' ||
          ((parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration') &&
            parent.parent?.type === 'Program')

        if (isModuleScope) {
          return
        }

        context.report({
          node,
          message: 'Use let for local bindings; reserve const for module scope.',
          fix(fixer) {
            return fixer.replaceTextRange([node.range[0], node.range[0] + 5], 'let')
          },
        })
      },
    }
  },
}

let noTypescriptAccessibilityRule = {
  meta: {
    type: 'problem',
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        if (!node.accessibility) {
          return
        }

        context.report({
          node,
          message: "Use native class fields: omit 'public' and use '#private' for private state.",
        })
      },
      MethodDefinition(node) {
        if (!node.accessibility) {
          return
        }

        if (node.kind !== 'constructor') {
          context.report({
            node,
            message:
              "Use native methods: omit 'public'; for private behavior use '#private' fields/methods.",
          })
          return
        }

        if (node.accessibility === 'public') {
          context.report({
            node,
            message: "Omit 'public' on constructors; it's the default.",
          })
        }
      },
      TSParameterProperty(node) {
        if (!node.accessibility) {
          return
        }

        context.report({
          node,
          message:
            "Avoid TS parameter properties; declare fields explicitly and use '#private' when needed.",
        })
      },
    }
  },
}

export default {
  meta: {
    name: 'remix',
  },
  rules: {
    'interface-pascal-case': interfacePascalCaseRule,
    'no-typescript-accessibility': noTypescriptAccessibilityRule,
    'prefer-let-locals': preferLetLocalsRule,
  },
}
