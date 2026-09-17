import { removeRemixReadmes, syncRemixReadmes } from './utils/remix-readmes.ts'
import { removeRemixSchema, syncRemixSchema } from './utils/remix-schema.ts'

const clean = process.argv.includes('--clean')

if (clean) {
  await removeRemixReadmes()
  await removeRemixSchema()
  console.log('Removed generated Remix README mirrors.')
  console.log('Removed generated Remix schema.')
} else {
  let readmes = await syncRemixReadmes()
  await syncRemixSchema()
  console.log(`Synced ${readmes.length} generated Remix README mirrors.`)
  console.log('Synced Remix schema.')
}
