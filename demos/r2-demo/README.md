# R2 Demo

Demo of `@remix-run/file-storage` R2FileStorage API with Cloudflare Workers.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- pnpm: `npx pnpm install -g pnpm`

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Login to Cloudflare

```bash
pnpm wrangler login
```

### 3. Create R2 Buckets

```bash
pnpm wrangler r2 bucket create r2-demo
pnpm wrangler r2 bucket create r2-demo-local
```

### 4. Start Development Server

```bash
pnpm dev
```

Open `http://localhost:5173` in your browser.

## Deployment

Build and deploy to Cloudflare Workers:

```bash
pnpm deploy
```

## Demo Structure

### `wrangler.jsonc`

Configuration for Cloudflare Workers:

- **R2 bucket bindings**: Maps R2 buckets to environment variables (`r2_demo`, `r2_demo_local`)
- **Compatibility date**: API version date
- **Main entry point**: Points to `src/index.ts`

### `src/index.ts`

Vibe Coded Single-page application with R2FileStorage operations:

#### Initialization

```typescript
const storage = new R2FileStorage(env.r2_demo)
```

#### API Endpoints
##
##### Follows the interface provided in **`file-storage.ts`**

**`PUT /put`** - Upload file, returns uploaded file
- Storage class, SSEC encryption, checksums (MD5, SHA-1, SHA-256, SHA-384, SHA-512)

**`PUT /set`** - Upload file, returns confirmation text
- Same options as `/put`, no file return

**`GET /{key}`** - Retrieve file by key
- Query params: `etag-match`, `etag-none-match`, `uploaded-before`, `uploaded-after`
- Range support: `range-offset`, `range-length`, `range-suffix`
- SSEC decryption: `ssec-key`

**`DELETE /remove?key=`** - Delete file by key

**`GET /has?key=`** - Check if file exists

**`GET /list?prefix=&limit=&cursor=`** - List files with pagination


### `vite.config.ts`

Uses `@cloudflare/vite-plugin` for Workers development with local R2 simulation.

