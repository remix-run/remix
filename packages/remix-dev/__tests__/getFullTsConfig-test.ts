import path from "path";

import { getFullTsConfig } from "../compiler/utils/tsconfig/getFullTsConfig";

describe("getFullTsConfig", () => {
  test('reads correct tsconfig options when "extends" is not provided', async () => {
    let { fullConfig } = await getFullTsConfig(
      path.resolve(__dirname, "./fixtures/tsconfig/tsconfig.base.json")
    );
    expect(fullConfig.options).toMatchInlineSnapshot(`
      Object {
        "configFilePath": undefined,
        "esModuleInterop": true,
        "strict": true,
      }
    `);
  });

  test('reads correct tsconfig options when "extends" is provided', async () => {
    let { fullConfig } = await getFullTsConfig(
      path.resolve(__dirname, "./fixtures/tsconfig/tsconfig.json")
    );

    // exclude properties that have device specific paths
    let { baseUrl, pathsBasePath, ...options } = fullConfig.options;
    expect(options).toMatchInlineSnapshot(`
      Object {
        "configFilePath": undefined,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "jsx": 4,
        "lib": Array [
          "lib.dom.d.ts",
          "lib.dom.iterable.d.ts",
          "lib.es2019.d.ts",
        ],
        "paths": Object {
          "~/*": Array [
            "./app/*",
          ],
        },
        "strict": true,
        "target": 6,
      }
    `);
  });

  test('reads correct tsconfig options when "extends" is provided for a non-relative path', async () => {
    let { fullConfig } = await getFullTsConfig(
      path.resolve(__dirname, "./fixtures/tsconfig/tsconfig.no-relative.json")
    );

    // exclude properties that have device specific paths
    let { baseUrl, pathsBasePath, outDir, rootDir, ...options } =
      fullConfig.options;

    expect(options).toMatchInlineSnapshot(`
      Object {
        "configFilePath": undefined,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "jsx": 4,
        "lib": Array [
          "lib.dom.d.ts",
          "lib.dom.iterable.d.ts",
          "lib.es2019.d.ts",
        ],
        "moduleResolution": 2,
        "paths": Object {
          "~/*": Array [
            "./app/*",
          ],
        },
        "strict": true,
        "target": 6,
      }
    `);
  });

  test("throws when config is invalid", async () => {
    await expect(
      getFullTsConfig(
        path.resolve(__dirname, "./fixtures/tsconfig/tsconfig.invalid.json")
      )
    ).rejects.toThrow(
      "error TS5024: Compiler option 'strict' requires a value of type boolean."
    );
  });
});
