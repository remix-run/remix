# List Files Demo

This demo shows how to use the `listFiles` option in the `@remix-run/static-middleware` package to display a directory listing when a directory is requested.

## Running the Demo

```bash
cd packages/static-middleware/demos/list-files
node server.js
```

Then visit `http://localhost:44100` in your browser to see the directory listing.

## What It Does

The demo serves files from the monorepo root directory and displays a nice-looking HTML table when you navigate to a directory. The table shows:

- Folder icon (📁) for directories
- File icon (📄) for files
- File size (formatted in KB, MB, etc.)
- File type (based on extension)
- Parent directory link (..) to navigate up

The page is responsive and adapts to different screen sizes using CSS media queries.

## Configuration

The demo uses these options:

- `listFiles: true` - Enable directory listing
- `index: false` - Disable index file serving so directories always show the listing

Try visiting:

- `http://localhost:44100/` - Root directory
- `http://localhost:44100/packages` - Packages directory
- `http://localhost:44100/packages/static-middleware` - This package
