import { definePlugin, defineRule } from '@oxlint/plugins'
import type { Context, ESTree, Fixer } from '@oxlint/plugins'

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

// Enforces the repo convention that `const` is reserved for module scope and
// local bindings should use `let` instead. The autofix only rewrites the
// declaration keyword, leaving module-scope exports and declarations untouched.
const plugin = definePlugin({
  meta: {
    name: 'remix-style',
  },
  rules: {
    'prefer-let-locals': preferLetLocalsRule,
  },
})

export default plugin
