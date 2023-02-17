import type { FileScope } from "@vanilla-extract/css";
import { stringify } from "javascript-stringify";
import isPlainObject from "lodash/isPlainObject";
import outdent from "outdent";

import { hash } from "./hash";

export function stringifyFileScope({
  packageName,
  filePath,
}: FileScope): string {
  return packageName ? `${filePath}$$$${packageName}` : filePath;
}

function stringifyExports(
  functionSerializationImports: Set<string>,
  value: any,
  unusedCompositionRegex: RegExp | null,
  key: string,
  exportLookup: Map<any, string>
): any {
  return stringify(
    value,
    (value, _indent, next) => {
      let valueType = typeof value;

      if (
        valueType === "boolean" ||
        valueType === "number" ||
        valueType === "undefined" ||
        value === null
      ) {
        return next(value);
      }

      if (Array.isArray(value) || isPlainObject(value)) {
        let reusedExport = exportLookup.get(value);

        if (reusedExport && reusedExport !== key) {
          return reusedExport;
        }
        return next(value);
      }

      if (Symbol.toStringTag in Object(value)) {
        let { [Symbol.toStringTag]: _tag, ...valueWithoutTag } = value;
        return next(valueWithoutTag);
      }

      if (valueType === "string") {
        return next(
          unusedCompositionRegex
            ? value.replace(unusedCompositionRegex, "")
            : value
        );
      }

      if (
        valueType === "function" &&
        (value.__function_serializer__ || value.__recipe__)
      ) {
        let { importPath, importName, args } =
          value.__function_serializer__ || value.__recipe__;

        if (
          typeof importPath !== "string" ||
          typeof importName !== "string" ||
          !Array.isArray(args)
        ) {
          throw new Error("Invalid function serialization params");
        }

        try {
          let hashedImportName = `_${hash(`${importName}${importPath}`).slice(
            0,
            5
          )}`;

          functionSerializationImports.add(
            `import { ${importName} as ${hashedImportName} } from '${importPath}';`
          );

          return `${hashedImportName}(${args
            .map((arg) =>
              stringifyExports(
                functionSerializationImports,
                arg,
                unusedCompositionRegex,
                key,
                exportLookup
              )
            )
            .join(",")})`;
        } catch (err) {
          console.error(err);

          throw new Error("Invalid function serialization params");
        }
      }

      throw new Error(outdent`
        Invalid exports.
        You can only export plain objects, arrays, strings, numbers and null/undefined.
      `);
    },
    0,
    {
      references: true, // Allow circular references
      maxDepth: Infinity,
      maxValues: Infinity,
    }
  );
}

const defaultExportName = "__default__";

export function serializeVanillaModule(
  cssImports: Array<string>,
  exports: Record<string, unknown>,
  unusedCompositionRegex: RegExp | null
) {
  let functionSerializationImports = new Set<string>();
  let exportLookup = new Map(
    Object.entries(exports).map(([key, value]) => [
      value,
      key === "default" ? defaultExportName : key,
    ])
  );

  let moduleExports = Object.keys(exports).map((key) => {
    let serializedExport = stringifyExports(
      functionSerializationImports,
      exports[key],
      unusedCompositionRegex,
      key === "default" ? defaultExportName : key,
      exportLookup
    );

    if (key === "default") {
      return [
        `var ${defaultExportName} = ${serializedExport};`,
        `export default ${defaultExportName};`,
      ].join("\n");
    }

    return `export var ${key} = ${serializedExport};`;
  });

  let outputCode = [
    ...cssImports,
    ...functionSerializationImports,
    ...moduleExports,
  ];

  return outputCode.join("\n");
}
