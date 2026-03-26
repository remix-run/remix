import { definePlugin, defineRule } from '@oxlint/plugins'
import type { Context, ESTree, Fixer, Variable } from '@oxlint/plugins'

function isModuleScopeDeclaration(node: ESTree.VariableDeclaration) {
  let parent = node.parent

  if (parent.type === 'Program') {
    return true
  }

  if (parent.type !== 'ExportNamedDeclaration' && parent.type !== 'ExportDefaultDeclaration') {
    return false
  }

  return parent.parent.type === 'Program'
}

function hasInitializers(node: ESTree.VariableDeclaration) {
  return node.declarations.every((declaration) => declaration.init != null)
}

function isConstEligibleModuleBinding(variable: Variable) {
  return variable.references.every((reference) => !reference.isWrite() || reference.init)
}

const preferLetLocalsRule = defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
  },
  create(context: Context) {
    return {
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (node.kind !== 'const') {
          return
        }

        if (isModuleScopeDeclaration(node)) {
          return
        }

        context.report({
          node,
          message: 'Use let for local bindings; reserve const for module scope.',
          fix(fixer: Fixer) {
            return fixer.replaceTextRange([node.range[0], node.range[0] + 5], 'let')
          },
        })
      },
    }
  },
})

const preferConstModuleScopeRule = defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
  },
  create(context: Context) {
    return {
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (node.kind !== 'let') {
          return
        }

        if (!isModuleScopeDeclaration(node)) {
          return
        }

        if (!hasInitializers(node)) {
          return
        }

        let declaredVariables = context.sourceCode.getDeclaredVariables(node)

        if (declaredVariables.length === 0) {
          return
        }

        if (!declaredVariables.every(isConstEligibleModuleBinding)) {
          return
        }

        context.report({
          node,
          message: 'Use const for module-scope bindings that are never reassigned.',
          fix(fixer: Fixer) {
            return fixer.replaceTextRange([node.range[0], node.range[0] + 3], 'const')
          },
        })
      },
    }
  },
})

/**
 * Enforces the repo convention that `const` is reserved for module scope and
 * local bindings should use `let` instead. Safe module-scope `let` declarations
 * are rewritten to `const`, and local `const` declarations are rewritten to
 * `let`.
 */
export default definePlugin({
  meta: {
    name: 'remix-style',
  },
  rules: {
    'prefer-const-module-scope': preferConstModuleScopeRule,
    'prefer-let-locals': preferLetLocalsRule,
  },
})
