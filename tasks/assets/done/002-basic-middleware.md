### Basic middleware that serves source files

Create a middleware that reads source files from a root directory and returns them.

**Acceptance Criteria:**

- [x] `assets(root)` function returns a middleware
- [x] Request for `/foo.tsx` reads `{root}/foo.tsx`
- [x] Returns file contents with `Content-Type: application/javascript`
- [x] Returns 404 for files that don't exist
- [x] Only handles `.ts`, `.tsx`, `.js`, `.jsx` extensions
- [x] Other requests pass through to next middleware
