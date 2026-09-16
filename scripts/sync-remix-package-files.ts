import { removeRemixGuides, syncRemixGuides } from './utils/remix-guides.ts'
import { removeRemixIndex, syncRemixIndex } from './utils/remix-index.ts'
import { removeRemixReadmes, syncRemixReadmes } from './utils/remix-readmes.ts'
import { removeRemixSchema, syncRemixSchema } from './utils/remix-schema.ts'

const clean = process.argv.includes('--clean')

if (clean) {
  await removeRemixGuides()
  await removeRemixIndex()
  await removeRemixReadmes()
  await removeRemixSchema()
  console.log('Removed generated Remix guides.')
  console.log('Removed generated Remix package index.')
  console.log('Removed generated Remix README mirrors.')
  console.log('Removed generated Remix schema.')
} else {
  let guides = await syncRemixGuides()
  let readmes = await syncRemixReadmes()
  await syncRemixIndex()
  await syncRemixSchema()
  console.log(`Synced ${guides.length} generated Remix guides.`)
  console.log('Synced Remix package index.')
  console.log(`Synced ${readmes.length} generated Remix README mirrors.`)
  console.log('Synced Remix schema.')
}
