import * as babel from "@babel/core";
import template from "@babel/template";

function maybeRewriteNodeValue(
  node: babel.types.StringLiteral,
  transformId: (id: string) => string
) {
  let oldId = node.value;
  let newId = transformId(oldId);

  if (oldId !== newId) {
    node.value = newId;
  }
}

export function rewriteIds(
  transformId: (id: string) => string
): babel.PluginObj {
  return {
    name: "rewrite-ids",
    manipulateOptions(
      _opts: babel.TransformOptions,
      parserOpts: babel.ParserOptions
    ) {
      parserOpts.plugins!.push(
        "dynamicImport",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        "importMeta"
      );
    },
    visitor: {
      CallExpression(path: babel.NodePath<babel.types.CallExpression>) {
        if (path.node.callee.type !== "Import") {
          // Some function call other than import().
          return;
        }

        let arg = path.node.arguments[0];
        if (arg.type !== "StringLiteral") {
          return;
        }

        maybeRewriteNodeValue(arg, transformId);
      },
      ExportAllDeclaration(
        path: babel.NodePath<babel.types.ExportAllDeclaration>
      ) {
        maybeRewriteNodeValue(path.node.source, transformId);
      },
      ExportNamedDeclaration(
        path: babel.NodePath<babel.types.ExportNamedDeclaration>
      ) {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return;
        }

        maybeRewriteNodeValue(path.node.source, transformId);
      },
      ImportDeclaration(path: babel.NodePath<babel.types.ImportDeclaration>) {
        maybeRewriteNodeValue(path.node.source, transformId);
      }
    }
  };
}

const hmrImportTemplate = template(`
import * as __hmr_client__ from "__HMR_CLIENT_MODULE_ID__";
import.meta.hot = __hmr_client__.createHotContext(import.meta.url);
`);

export function enableMetaHot(
  hmrClientModuleId = "__HMR_CLIENT_MODULE_ID__"
): babel.PluginObj {
  let hmrImportAst = hmrImportTemplate({
    __HMR_CLIENT_MODULE_ID__: hmrClientModuleId
  });

  return {
    name: "enable-meta-hot",
    manipulateOptions(
      _opts: babel.TransformOptions,
      parserOpts: babel.ParserOptions
    ) {
      parserOpts.plugins!.push("importMeta");
    },
    pre() {
      this.alreadyInserted = false;
    },
    visitor: {
      MetaProperty(path: babel.NodePath<babel.types.MetaProperty>) {
        if (this.alreadyInserted) return;

        let t = babel.types;

        if (
          t.isIdentifier(path.node.meta) &&
          path.node.meta.name === "import" &&
          t.isIdentifier(path.node.property) &&
          path.node.property.name === "meta" &&
          t.isMemberExpression(path.parentPath.node) &&
          t.isIdentifier(path.parentPath.node.property) &&
          path.parentPath.node.property.name === "hot"
        ) {
          let program = path.findParent(p => p.isProgram()) as babel.NodePath<
            babel.types.Program
          >;
          program.unshiftContainer("body", hmrImportAst);

          this.alreadyInserted = true;
        }
      }
    }
  };
}
