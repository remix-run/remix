# fetch-router Bun Example

This example is a [Bun](https://bun.sh/) server that handles routing using `@remix-run/fetch-router`.

## Bun-Specific Features

This demo showcases Bun's unique ability to efficiently serve static files from the filesystem using `Bun.file()`. The `staticFiles()` middleware automatically serves any file from the `public/` directory:

- **Native File Serving**: Uses `Bun.file()` to create file references without loading files into memory
- **Automatic MIME Types**: Bun automatically detects and sets MIME types based on file extensions
- **Efficient Streaming**: Files are streamed directly from disk without buffering
- **File Existence Checks**: Uses `file.exists()` to check if files exist before serving
- **Middleware-Based**: Runs as middleware, so it handles static files before route handlers

See `router.ts` for the `staticFiles()` middleware implementation. Any file placed in the `public/` directory will be automatically served (e.g., `/favicon.ico`, `/style.css`, `/images/logo.png`, etc.).
