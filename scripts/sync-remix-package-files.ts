import { removeRemixReadmes, syncRemixReadmes } from './utils/remix-readmes.ts'
import { removeRemixSchema, syncRemixSchema } from './utils/remix-schema.ts'

const clean = process.argv.includes('--clean')

if (clean) {
  await removeRemixReadmes()
  await removeRemixSchema()
  console.log('Removed generated remix README mirrors.')
  console.log('Removed generated Remix schema.')
} else {
  let copies = await syncRemixReadmes()
  await syncRemixSchema()
  console.log(`Synced ${copies.length} generated remix README mirrors.`)
  console.log('Synced Remix schema.')
}
