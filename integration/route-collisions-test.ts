import { test, expect } from "@playwright/test";

import { createFixture, js } from "./helpers/create-fixture";

let ROOT_FILE_CONTENTS = js`
  import { Outlet, Scripts } from "@remix-run/react";

  export default function App() {
    return (
      <html lang="en">
        <body>
          <Outlet />
          <Scripts />
        </body>
      </html>
    );
  }
`;

let LAYOUT_FILE_CONTENTS = js`
  import { Outlet } from "@remix-run/react";

  export default function Layout() {
    return <Outlet />
  }
`;

let LEAF_FILE_CONTENTS = js`
  export default function Foo() {
    return <h1>Foo</h1>;
  }
`;

test.describe("build failures", () => {
  let errorLogs: string[];
  let oldConsoleError: typeof console.error;

  test.beforeEach(() => {
    errorLogs = [];
    oldConsoleError = console.error;
    console.error = (str) => errorLogs.push(str);
  });

  test.afterEach(() => {
    console.error = oldConsoleError;
  });

  test("detects path collisions inside pathless layout routes", async () => {
    try {
      await createFixture({
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/foo.jsx": LEAF_FILE_CONTENTS,
          "app/routes/__pathless.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless/foo.jsx": LEAF_FILE_CONTENTS,
        },
      });
      expect(false).toBe(true);
    } catch (e) {
      expect(errorLogs[0]).toMatch(
        'Error: Path "foo" defined by route "routes/foo" conflicts with route "routes/__pathless/foo"'
      );
      expect(errorLogs.length).toBe(1);
    }
  });

  test("detects path collisions across pathless layout routes", async () => {
    try {
      await createFixture({
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/__pathless.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless/foo.jsx": LEAF_FILE_CONTENTS,
          "app/routes/__pathless2.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless2/foo.jsx": LEAF_FILE_CONTENTS,
        },
      });
      expect(false).toBe(true);
    } catch (e) {
      expect(errorLogs[0]).toMatch(
        'Error: Path "foo" defined by route "routes/__pathless/foo" conflicts with route "routes/__pathless2/foo"'
      );
      expect(errorLogs.length).toBe(1);
    }
  });

  test("detects path collisions inside multiple pathless layout routes", async () => {
    try {
      await createFixture({
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/foo.jsx": LEAF_FILE_CONTENTS,
          "app/routes/__pathless.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless/__again.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless/__again/foo.jsx": LEAF_FILE_CONTENTS,
        },
      });
      expect(false).toBe(true);
    } catch (e) {
      expect(errorLogs[0]).toMatch(
        'Error: Path "foo" defined by route "routes/foo" conflicts with route "routes/__pathless/__again/foo"'
      );
      expect(errorLogs.length).toBe(1);
    }
  });

  test("detects path collisions of index files inside pathless layouts", async () => {
    try {
      await createFixture({
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/index.jsx": LEAF_FILE_CONTENTS,
          "app/routes/__pathless.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless/index.jsx": LEAF_FILE_CONTENTS,
        },
      });
      expect(false).toBe(true);
    } catch (e) {
      expect(errorLogs[0]).toMatch(
        'Error: Path "/" defined by route "routes/index" conflicts with route "routes/__pathless/index"'
      );
      expect(errorLogs.length).toBe(1);
    }
  });

  test("detects path collisions of index files across multiple pathless layouts", async () => {
    try {
      await createFixture({
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/nested/__pathless.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/nested/__pathless/index.jsx": LEAF_FILE_CONTENTS,
          "app/routes/nested/__oops.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/nested/__oops/index.jsx": LEAF_FILE_CONTENTS,
        },
      });
      expect(false).toBe(true);
    } catch (e) {
      expect(errorLogs[0]).toMatch(
        'Error: Path "nested" defined by route "routes/nested/__oops/index" conflicts with route "routes/nested/__pathless/index"'
      );
      expect(errorLogs.length).toBe(1);
    }
  });

  test("detects path collisions of param routes inside pathless layouts", async () => {
    try {
      await createFixture({
        files: {
          "app/root.tsx": ROOT_FILE_CONTENTS,
          "app/routes/$param.jsx": LEAF_FILE_CONTENTS,
          "app/routes/__pathless.jsx": LAYOUT_FILE_CONTENTS,
          "app/routes/__pathless/$param.jsx": LEAF_FILE_CONTENTS,
        },
      });
      expect(false).toBe(true);
    } catch (e) {
      expect(errorLogs[0]).toMatch(
        'Error: Path ":param" defined by route "routes/$param" conflicts with route "routes/__pathless/$param"'
      );
      expect(errorLogs.length).toBe(1);
    }
  });
});
