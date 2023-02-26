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
    expect(fullConfig.options).toMatchInlineSnapshot(`
      Object {
        "baseUrl": "C:/Users/AliZ/work/remix/packages/remix-dev/__tests__/fixtures/tsconfig",
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
        "pathsBasePath": "C:/Users/AliZ/work/remix/packages/remix-dev/__tests__/fixtures/tsconfig",
        "strict": true,
        "target": 6,
      }
    `);
  });
});
