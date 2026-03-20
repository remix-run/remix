import { mkdir, cp } from 'node:fs/promises'
import { join } from 'node:path'

let publicDir = join(process.cwd(), 'public')
let assetsDir = join(process.cwd(), 'build', 'assets')

await mkdir(assetsDir, { recursive: true })
await cp(publicDir, assetsDir, { recursive: true })
