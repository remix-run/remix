### esbuild transform integration

Transform source files with esbuild before serving.

**Acceptance Criteria:**

- [x] TypeScript is compiled to JavaScript
- [x] JSX is transformed using `jsx: 'automatic'`
- [x] `jsxImportSource` defaults to `@remix-run/component`
- [x] Correct loader is selected based on file extension
- [x] Transform errors return 500 with useful error message
