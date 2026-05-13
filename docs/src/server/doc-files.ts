import type { DemoDocFile } from './demo.tsx'
import type { ApiDocFile, PackageDocFile } from './markdown.ts'

export type MarkdownDocFile = ApiDocFile | PackageDocFile
export type DocFile = MarkdownDocFile | DemoDocFile
