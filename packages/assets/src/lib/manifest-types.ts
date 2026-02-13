/**
 * Shape compatible with assets-middleware AssetManifest.
 * Used for build manifest output so prod serve can use the same middleware.
 */
export interface AssetManifest {
  scripts: {
    outputs: {
      [outputPath: string]: {
        entryPoint?: string
        imports?: Array<{ path: string; kind: string }>
      }
    }
  }
  files: {
    outputs: {
      [sourcePath: string]:
        | {
            path: string
          }
        | {
            variants: {
              [variant: string]: {
                path: string
              }
            }
            default?: string
          }
    }
  }
}
