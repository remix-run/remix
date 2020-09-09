import babelTransform from "../babelTransform";
import { rewriteIds } from "../babelPlugins";

async function transform(
  source: string,
  transformId: (id: string) => string
): Promise<string> {
  let result = await babelTransform(source, {
    configFile: false,
    plugins: [rewriteIds(transformId)]
  });

  return result.code;
}

describe("rewriteIds", () => {
  it("rewrites bare module ids in import statements", async () => {
    let source = `
      import React from 'react';
      import ReactDOM from 'react-dom';
      console.log(React, ReactDOM);
    `;

    let result = await transform(source, id => `/_npm/${id}.js`);

    expect(result).toMatchInlineSnapshot(`
      "import React from \\"/_npm/react.js\\";
      import ReactDOM from \\"/_npm/react-dom.js\\";
      console.log(React, ReactDOM);"
    `);
  });

  it("rewrites bare module ids in import * statements", async () => {
    let source = `
      import * as React from 'react';
      import * as ReactDOM from 'react-dom';
      console.log(React, ReactDOM);
    `;

    let result = await transform(source, id => `/_npm/${id}.js`);

    expect(result).toMatchInlineSnapshot(`
      "import * as React from \\"/_npm/react.js\\";
      import * as ReactDOM from \\"/_npm/react-dom.js\\";
      console.log(React, ReactDOM);"
    `);
  });

  it("rewrites bare module ids in dynamic import() statements", async () => {
    let source = `
      async function importReact() {
        let react = await import('react');
        return react;
      }

      importReact().then(react => {
        console.log(react);
      });
    `;

    let result = await transform(source, id => `/_npm/${id}.js`);

    expect(result).toMatchInlineSnapshot(`
      "async function importReact() {
        let react = await import(\\"/_npm/react.js\\");
        return react;
      }

      importReact().then(react => {
        console.log(react);
      });"
    `);
  });

  it("rewrites bare module ids in export statements", async () => {
    let source = `
      export { useState } from 'react';
    `;

    let result = await transform(source, id => `/_npm/${id}`);

    expect(result).toMatchInlineSnapshot(
      `"export { useState } from \\"/_npm/react\\";"`
    );
  });
});
